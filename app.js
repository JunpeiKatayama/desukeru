const container = document.getElementById('container');
        const video = document.getElementById('video');
        const overlay = document.getElementById('overlay');
        const ctx = overlay.getContext('2d');
        const errorDiv = document.getElementById('error');
        const imagePreviewDiv = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        const closePreviewBtn = document.getElementById('closePreview');
        const uploadedImage = document.getElementById('uploadedImage');
        const imageInput = document.getElementById('imageInput');

        const scaleTypeSelect = document.getElementById('scaleType');
        const formatSelect = document.getElementById('format');
        const colorInput = document.getElementById('scaleColor');
        const switchCameraBtn = document.getElementById('switchCamera');
        const captureBtn = document.getElementById('captureButton');
        const fullscreenBtn = document.getElementById('fullscreen');
        const loadImageBtn = document.getElementById('loadImage');
        const backToCameraBtn = document.getElementById('backToCamera');
        const toggleControlsBtn = document.getElementById('toggleControls');
        const openControlsBtn = document.getElementById('openControls');
        const controlsDiv = document.getElementById('controls');
        const resizeHandles = Array.from(document.querySelectorAll('.resize-handle'));

        let currentStream = null;
        let facingMode = 'environment'; // 'user' for front camera, 'environment' for back camera
        let mode = 'camera'; // 'camera' or 'image'
        let hasRenderedOverlay = false;
        const overlayState = {
            centerX: 0.5, // normalized (0-1)
            centerY: 0.5, // normalized (0-1)
            scale: 0.85,
            scaleX: 0.85,
            scaleY: 0.85,
            aspect: 16 / 9
        };
        const imageState = {
            scale: 1,
            tx: 0,
            ty: 0,
            baseScale: 1,
            naturalWidth: 0,
            naturalHeight: 0
        };
        let isPanning = false;
        let lastPanPosition = { x: 0, y: 0 };
        let gestureStart = null;
        const activePointers = new Map();

        function stopCamera() {
            if (!currentStream) return;
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
            video.srcObject = null;
        }

        // Initialize camera
        async function initCamera() {
            try {
                stopCamera();

                const constraints = {
                    video: {
                        facingMode: facingMode,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };

                currentStream = await navigator.mediaDevices.getUserMedia(constraints);
                video.srcObject = currentStream;

                video.onloadedmetadata = () => {
                    resizeOverlay();
                };

            } catch (err) {
                showError('カメラへのアクセスに失敗しました: ' + err.message);
            }
        }

        function switchToCameraMode() {
            mode = 'camera';
            uploadedImage.style.display = 'none';
            uploadedImage.src = '';
            backToCameraBtn.style.display = 'none';
            video.style.display = 'block';
            switchCameraBtn.disabled = false;
            imageInput.value = '';
            resetOverlayState();
            resetImageTransform();
            initCamera();
            resizeOverlay();
        }

        function switchToImageMode() {
            mode = 'image';
            video.style.display = 'none';
            uploadedImage.style.display = 'block';
            backToCameraBtn.style.display = 'block';
            switchCameraBtn.disabled = true;
            applyImageTransform();
            resizeOverlay();
        }

        function handleImageSelection(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            const imageUrl = URL.createObjectURL(file);
            uploadedImage.onload = () => {
                imageState.naturalWidth = uploadedImage.naturalWidth;
                imageState.naturalHeight = uploadedImage.naturalHeight;
                resetImageTransform();
                updateImageBaseScale();
                resetOverlayState();
                URL.revokeObjectURL(imageUrl);
                stopCamera();
                switchToImageMode();
            };
            uploadedImage.onerror = () => {
                showError('画像の読み込みに失敗しました');
            };
            uploadedImage.src = imageUrl;
            imageInput.value = '';
        }

        // Resize overlay to match container
        function resizeOverlay() {
            overlay.width = window.innerWidth;
            overlay.height = window.innerHeight;
            if (mode === 'image' && imageState.naturalWidth) {
                updateImageBaseScale();
            }
            overlayState.aspect = getTargetAspect(formatSelect.value);
            clampOverlayToCanvas();
            drawScale();
        }

        function getActiveDisplayRect() {
            if (mode === 'image' && uploadedImage.style.display !== 'none') {
                const rect = uploadedImage.getBoundingClientRect();
                if (rect.width && rect.height) {
                    return rect;
                }
            }

            const rect = video.getBoundingClientRect();
            if (rect.width && rect.height) {
                return rect;
            }

            return null;
        }

        function getTargetAspect(format) {
            switch (format) {
                case 'square':
                    return 1;
                case 'free':
                    return null;
                case '4:3':
                    return 4 / 3;
                case '3:2':
                    return 3 / 2;
                case '16:9':
                    return 16 / 9;
                case '9:16':
                    return 9 / 16;
                case 'a4':
                    return 210 / 297;
                case 'none':
                default:
                    return overlay.height ? overlay.width / overlay.height : 1;
            }
        }

        function updateOverlayAspect() {
            overlayState.aspect = getTargetAspect(formatSelect.value);
            clampOverlayToCanvas();
            drawScale();
        }

        function clampOverlayToCanvas() {
            let rect = getOverlayRect();

            if (rect.width > overlay.width || rect.height > overlay.height) {
                const scaleFix = Math.min(
                    overlay.width / rect.width || 1,
                    overlay.height / rect.height || 1
                );
                overlayState.scale = clampScale(overlayState.scale * scaleFix);
                rect = getOverlayRect();
            }
            let centerX = rect.centerX;
            let centerY = rect.centerY;
            const halfW = rect.width / 2;
            const halfH = rect.height / 2;
            if (halfW === 0 || halfH === 0) return;

            if (centerX - halfW < 0) centerX = halfW;
            if (centerX + halfW > overlay.width) centerX = overlay.width - halfW;
            if (centerY - halfH < 0) centerY = halfH;
            if (centerY + halfH > overlay.height) centerY = overlay.height - halfH;

            overlayState.centerX = overlay.width ? centerX / overlay.width : 0.5;
            overlayState.centerY = overlay.height ? centerY / overlay.height : 0.5;
        }

        function getOverlayRect() {
            const isFree = formatSelect.value === 'free';
            if (isFree) {
                const width = overlay.width * overlayState.scaleX;
                const height = overlay.height * overlayState.scaleY;
                const centerX = overlayState.centerX * overlay.width;
                const centerY = overlayState.centerY * overlay.height;
                return { width, height, centerX, centerY, aspect: width / height };
            }

            const aspect = overlayState.aspect || (overlay.height ? overlay.width / overlay.height : 1);
            const baseSize = Math.min(overlay.width, overlay.height) * overlayState.scale;
            let width, height;
            if (aspect >= 1) {
                width = baseSize;
                height = baseSize / aspect;
            } else {
                width = baseSize * aspect;
                height = baseSize;
            }
            const centerX = overlayState.centerX * overlay.width;
            const centerY = overlayState.centerY * overlay.height;
            return { width, height, centerX, centerY, aspect };
        }

        function computeFormatBounds(format) {
            overlayState.aspect = getTargetAspect(format);
            clampOverlayToCanvas();
            const rect = getOverlayRect();
            const x = rect.centerX - rect.width / 2;
            const y = rect.centerY - rect.height / 2;
            return { x, y, width: rect.width, height: rect.height };
        }

        // Draw scale overlay
        function drawScale() {
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            const color = colorInput.value;
            const opacity = 0.5; // Fixed opacity at 50%

            // Convert hex to rgba
            const r = parseInt(color.substr(1, 2), 16);
            const g = parseInt(color.substr(3, 2), 16);
            const b = parseInt(color.substr(5, 2), 16);

            // Draw format overlay first and get the active drawing area
            const bounds = drawFormat(r, g, b, opacity);
            if (!bounds) return;
            if (!hasRenderedOverlay) {
                overlay.style.opacity = '1';
                hasRenderedOverlay = true;
            }
            updateHandlePositions();

            // Draw scale type within the bounds
            const scaleType = scaleTypeSelect.value;
            if (scaleType === 'none') return;

            // Set stroke style for scale lines (after drawFormat)
            const strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1;

            switch (scaleType) {
                case 'grid':
                    drawGrid(bounds);
                    break;
                case 'ruler':
                    drawRuler(bounds);
                    break;
                case 'quarters':
                    drawQuarters(bounds);
                    break;
                case 'quartersGrid':
                    drawQuartersGrid(bounds);
                    break;
                case 'thirds':
                    drawThirds(bounds);
                    break;
                case 'golden':
                    drawGoldenRatio(bounds);
                    break;
            }
        }

        function drawGrid(bounds) {
            drawSquareGrid(ctx, bounds);
        }

        function drawRuler(bounds) {
            const { x, y, width, height } = bounds;
            const spacing = Math.min(width, height) / 10;

            // Top ruler
            for (let i = 0; i < width; i += spacing / 5) {
                const tickHeight = (Math.abs(i % spacing) < 0.01) ? 40 : 20;
                ctx.beginPath();
                ctx.moveTo(x + i, y);
                ctx.lineTo(x + i, y + tickHeight);
                ctx.stroke();
            }

            // Left ruler
            for (let i = 0; i < height; i += spacing / 5) {
                const tickWidth = (Math.abs(i % spacing) < 0.01) ? 40 : 20;
                ctx.beginPath();
                ctx.moveTo(x, y + i);
                ctx.lineTo(x + tickWidth, y + i);
                ctx.stroke();
            }
        }

        function drawQuarters(bounds) {
            const { x, y, width, height } = bounds;

            // Vertical center line
            const cx = Math.round(x + width / 2) + 0.5;
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(cx, y + height);
            ctx.stroke();

            // Horizontal center line
            const cy = Math.round(y + height / 2) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, cy);
            ctx.lineTo(x + width, cy);
            ctx.stroke();
        }

        function drawQuartersGrid(bounds) {
            const { x, y, width, height } = bounds;

            // Draw 3 vertical lines (creating 4 columns)
            for (let i = 1; i <= 3; i++) {
                const vx = Math.round(x + (width * i / 4)) + 0.5;
                ctx.beginPath();
                ctx.moveTo(vx, y);
                ctx.lineTo(vx, y + height);
                ctx.stroke();
            }

            // Draw 3 horizontal lines (creating 4 rows)
            for (let i = 1; i <= 3; i++) {
                const hy = Math.round(y + (height * i / 4)) + 0.5;
                ctx.beginPath();
                ctx.moveTo(x, hy);
                ctx.lineTo(x + width, hy);
                ctx.stroke();
            }
        }

        function drawThirds(bounds) {
            const { x, y, width, height } = bounds;

            // Vertical lines
            const v1 = Math.round(x + width / 3) + 0.5;
            ctx.beginPath();
            ctx.moveTo(v1, y);
            ctx.lineTo(v1, y + height);
            ctx.stroke();

            const v2 = Math.round(x + width * 2 / 3) + 0.5;
            ctx.beginPath();
            ctx.moveTo(v2, y);
            ctx.lineTo(v2, y + height);
            ctx.stroke();

            // Horizontal lines
            const h1 = Math.round(y + height / 3) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, h1);
            ctx.lineTo(x + width, h1);
            ctx.stroke();

            const h2 = Math.round(y + height * 2 / 3) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, h2);
            ctx.lineTo(x + width, h2);
            ctx.stroke();
        }

        function drawGoldenRatio(bounds) {
            const { x, y, width, height } = bounds;
            const phi = 1.618;

            // Vertical lines
            const v1 = Math.round(x + width / phi) + 0.5;
            ctx.beginPath();
            ctx.moveTo(v1, y);
            ctx.lineTo(v1, y + height);
            ctx.stroke();

            const v2 = Math.round(x + width - width / phi) + 0.5;
            ctx.beginPath();
            ctx.moveTo(v2, y);
            ctx.lineTo(v2, y + height);
            ctx.stroke();

            // Horizontal lines
            const h1 = Math.round(y + height / phi) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, h1);
            ctx.lineTo(x + width, h1);
            ctx.stroke();

            const h2 = Math.round(y + height - height / phi) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, h2);
            ctx.lineTo(x + width, h2);
            ctx.stroke();
        }

        function drawFormat(r, g, b, opacity) {
            const format = formatSelect.value;
            const bounds = computeFormatBounds(format);
            if (!bounds) return null;

            const { x, y, width: formatWidth, height: formatHeight } = bounds;

            // Draw semi-transparent overlay outside the format area
            ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.7})`;

            // Top overlay
            ctx.fillRect(0, 0, overlay.width, y);
            // Bottom overlay
            ctx.fillRect(0, y + formatHeight, overlay.width, overlay.height - y - formatHeight);
            // Left overlay
            ctx.fillRect(0, y, x, formatHeight);
            // Right overlay
            ctx.fillRect(x + formatWidth, y, overlay.width - x - formatWidth, formatHeight);

            // Draw format border (pixel-perfect)
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.lineWidth = 2;
            const bx = Math.round(x) + 1;
            const by = Math.round(y) + 1;
            const bw = Math.round(formatWidth) - 2;
            const bh = Math.round(formatHeight) - 2;

            ctx.beginPath();
            // Top
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + bw, by);
            // Right
            ctx.lineTo(bx + bw, by + bh);
            // Bottom
            ctx.lineTo(bx, by + bh);
            // Left
            ctx.lineTo(bx, by);
            ctx.closePath();
            ctx.stroke();

            // Return the format bounds for scale drawing
            return { x: x, y: y, width: formatWidth, height: formatHeight };
        }

        function clampScale(value) {
            return Math.min(5, Math.max(0.2, value));
        }

        function setOverlayScale(newScale) {
            if (formatSelect.value === 'free') {
                overlayState.scaleX = clampScale(newScale);
                overlayState.scaleY = clampScale(newScale);
            } else {
                overlayState.scale = clampScale(newScale);
            }
            clampOverlayToCanvas();
            updateHandlePositions();
            drawScale();
        }

        function updateHandlePositions() {
            const format = formatSelect.value;
            const bounds = computeFormatBounds(format);
            if (!bounds) return;
            const { x, y, width, height } = bounds;
            const size = 12; // matches .resize-handle width/height
            const offset = size / 2;
            const positions = {
                nw: { x: x - offset, y: y - offset },
                ne: { x: x + width - offset, y: y - offset },
                sw: { x: x - offset, y: y + height - offset },
                se: { x: x + width - offset, y: y + height - offset },
            };
            resizeHandles.forEach(handle => {
                const corner = handle.dataset.corner;
                const pos = positions[corner];
                handle.style.left = `${pos.x}px`;
                handle.style.top = `${pos.y}px`;
            });
        }

        function moveOverlay(dx, dy) {
            if (!overlay.width || !overlay.height) return;
            overlayState.centerX += dx / overlay.width;
            overlayState.centerY += dy / overlay.height;
            clampOverlayToCanvas();
            updateHandlePositions();
            drawScale();
        }

        function resetOverlayState() {
            overlayState.centerX = 0.5;
            overlayState.centerY = 0.5;
            overlayState.scale = 0.85;
            overlayState.scaleX = 0.85;
            overlayState.scaleY = 0.85;
            overlayState.aspect = getTargetAspect(formatSelect.value);
            clampOverlayToCanvas();
            drawScale();
        }

        function updateImageBaseScale() {
            if (!imageState.naturalWidth || !imageState.naturalHeight) return;
            imageState.baseScale = Math.min(
                window.innerWidth / imageState.naturalWidth,
                window.innerHeight / imageState.naturalHeight
            );
            applyImageTransform();
        }

        function applyImageTransform() {
            if (mode !== 'image' || !imageState.naturalWidth) return;
            const displayWidth = imageState.naturalWidth * imageState.baseScale * imageState.scale;
            const displayHeight = imageState.naturalHeight * imageState.baseScale * imageState.scale;

            uploadedImage.style.width = `${displayWidth}px`;
            uploadedImage.style.height = `${displayHeight}px`;
            uploadedImage.style.transform = `translate(-50%, -50%) translate(${imageState.tx}px, ${imageState.ty}px)`;
            drawScale();
        }

        function resetImageTransform() {
            imageState.scale = 1;
            imageState.tx = 0;
            imageState.ty = 0;
        }

        function pointerDistance(p1, p2) {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            return Math.hypot(dx, dy);
        }

        function pointerCenter(p1, p2) {
            return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        }

        function drawSelectedScaleOnCanvas(ctx, bounds) {
            const scaleType = scaleTypeSelect.value;
            if (scaleType === 'none') return;

            const color = colorInput.value;
            const opacity = 0.5; // Fixed opacity at 50%
            const r = parseInt(color.substr(1, 2), 16);
            const g = parseInt(color.substr(3, 2), 16);
            const b = parseInt(color.substr(5, 2), 16);

            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            ctx.lineWidth = 1;

            switch (scaleType) {
                case 'grid':
                    drawGridOnCanvas(ctx, bounds);
                    break;
                case 'ruler':
                    drawRulerOnCanvas(ctx, bounds);
                    break;
                case 'quarters':
                    drawQuartersOnCanvas(ctx, bounds);
                    break;
                case 'quartersGrid':
                    drawQuartersGridOnCanvas(ctx, bounds);
                    break;
                case 'thirds':
                    drawThirdsOnCanvas(ctx, bounds);
                    break;
                case 'golden':
                    drawGoldenRatioOnCanvas(ctx, bounds);
                    break;
            }
        }

        function captureImage() {
            try {
                const format = formatSelect.value;
                let dataUrl = null;

                const formatBounds = computeFormatBounds(format);
                const displayRect = getActiveDisplayRect();
                if (!formatBounds || !displayRect) {
                    showError('表示中の領域を取得できませんでした');
                    return;
                }

                const isImageMode = mode === 'image';
                const naturalWidth = isImageMode ? uploadedImage.naturalWidth : video.videoWidth;
                const naturalHeight = isImageMode ? uploadedImage.naturalHeight : video.videoHeight;
                const sourceEl = isImageMode ? uploadedImage : video;

                if (!naturalWidth || !naturalHeight) {
                    showError(isImageMode ? '画像が読み込まれていません' : 'カメラの準備ができていません');
                    return;
                }

                const scale = naturalWidth / displayRect.width;
                if (!scale || !isFinite(scale)) {
                    showError('スケール計算に失敗しました');
                    return;
                }

                const captureWidth = Math.max(1, Math.round(formatBounds.width * scale));
                const captureHeight = Math.max(1, Math.round(formatBounds.height * scale));
                let offsetX = Math.round((formatBounds.x - displayRect.left) * scale);
                let offsetY = Math.round((formatBounds.y - displayRect.top) * scale);

                offsetX = Math.max(0, Math.min(naturalWidth - captureWidth, offsetX));
                offsetY = Math.max(0, Math.min(naturalHeight - captureHeight, offsetY));

                const captureCanvas = document.createElement('canvas');
                captureCanvas.width = captureWidth;
                captureCanvas.height = captureHeight;
                const captureCtx = captureCanvas.getContext('2d');

                captureCtx.drawImage(
                    sourceEl,
                    offsetX, offsetY, captureWidth, captureHeight,
                    0, 0, captureWidth, captureHeight
                );

                drawSelectedScaleOnCanvas(captureCtx, { x: 0, y: 0, width: captureWidth, height: captureHeight });
                dataUrl = captureCanvas.toDataURL('image/png');

                if (!dataUrl) {
                    showError('画像の生成に失敗しました');
                    return;
                }

                previewImage.src = dataUrl;
                imagePreviewDiv.classList.add('visible');

                captureBtn.classList.add('active');
                setTimeout(() => {
                    captureBtn.classList.remove('active');
                }, 700);

            } catch (err) {
                showError('画像の保存に失敗しました: ' + err.message);
            }
        }

        // Helper functions for drawing on capture canvas
        function drawSquareGrid(targetCtx, bounds) {
            const { x, y, width, height } = bounds;
            const cellSize = Math.max(4, Math.min(width, height) / 10);
            const cols = Math.max(1, Math.floor(width / cellSize));
            const rows = Math.max(1, Math.floor(height / cellSize));
            const offsetX = x + (width - cols * cellSize) / 2;
            const offsetY = y + (height - rows * cellSize) / 2;

            targetCtx.save();
            targetCtx.lineWidth = 1;

            for (let i = 1; i < cols; i++) {
                const xpos = Math.round(offsetX + cellSize * i) + 0.5;
                targetCtx.beginPath();
                targetCtx.moveTo(xpos, Math.round(offsetY) + 0.5);
                targetCtx.lineTo(xpos, Math.round(offsetY + rows * cellSize) + 0.5);
                targetCtx.stroke();
            }
            for (let j = 1; j < rows; j++) {
                const ypos = Math.round(offsetY + cellSize * j) + 0.5;
                targetCtx.beginPath();
                targetCtx.moveTo(Math.round(offsetX) + 0.5, ypos);
                targetCtx.lineTo(Math.round(offsetX + cols * cellSize) + 0.5, ypos);
                targetCtx.stroke();
            }
            targetCtx.restore();
        }

        function drawGridOnCanvas(ctx, bounds) {
            drawSquareGrid(ctx, bounds);
        }

        function drawRulerOnCanvas(ctx, bounds) {
            const { x, y, width, height } = bounds;
            const spacing = Math.min(width, height) / 10;
            for (let i = 0; i < width; i += spacing / 5) {
                const tickHeight = (Math.abs(i % spacing) < 0.01) ? 40 : 20;
                ctx.beginPath();
                ctx.moveTo(x + i, y);
                ctx.lineTo(x + i, y + tickHeight);
                ctx.stroke();
            }
            for (let i = 0; i < height; i += spacing / 5) {
                const tickWidth = (Math.abs(i % spacing) < 0.01) ? 40 : 20;
                ctx.beginPath();
                ctx.moveTo(x, y + i);
                ctx.lineTo(x + tickWidth, y + i);
                ctx.stroke();
            }
        }

        function drawQuartersOnCanvas(ctx, bounds) {
            const { x, y, width, height } = bounds;
            const cx = Math.round(x + width / 2) + 0.5;
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(cx, y + height);
            ctx.stroke();
            const cy = Math.round(y + height / 2) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, cy);
            ctx.lineTo(x + width, cy);
            ctx.stroke();
        }

        function drawQuartersGridOnCanvas(ctx, bounds) {
            const { x, y, width, height } = bounds;
            // Draw 3 vertical lines (creating 4 columns)
            for (let i = 1; i <= 3; i++) {
                const vx = Math.round(x + (width * i / 4)) + 0.5;
                ctx.beginPath();
                ctx.moveTo(vx, y);
                ctx.lineTo(vx, y + height);
                ctx.stroke();
            }
            // Draw 3 horizontal lines (creating 4 rows)
            for (let i = 1; i <= 3; i++) {
                const hy = Math.round(y + (height * i / 4)) + 0.5;
                ctx.beginPath();
                ctx.moveTo(x, hy);
                ctx.lineTo(x + width, hy);
                ctx.stroke();
            }
        }

        function drawThirdsOnCanvas(ctx, bounds) {
            const { x, y, width, height } = bounds;
            const v1 = Math.round(x + width / 3) + 0.5;
            ctx.beginPath();
            ctx.moveTo(v1, y);
            ctx.lineTo(v1, y + height);
            ctx.stroke();
            const v2 = Math.round(x + width * 2 / 3) + 0.5;
            ctx.beginPath();
            ctx.moveTo(v2, y);
            ctx.lineTo(v2, y + height);
            ctx.stroke();
            const h1 = Math.round(y + height / 3) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, h1);
            ctx.lineTo(x + width, h1);
            ctx.stroke();
            const h2 = Math.round(y + height * 2 / 3) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, h2);
            ctx.lineTo(x + width, h2);
            ctx.stroke();
        }

        function drawGoldenRatioOnCanvas(ctx, bounds) {
            const { x, y, width, height } = bounds;
            const phi = 1.618;
            const v1 = Math.round(x + width / phi) + 0.5;
            ctx.beginPath();
            ctx.moveTo(v1, y);
            ctx.lineTo(v1, y + height);
            ctx.stroke();
            const v2 = Math.round(x + width - width / phi) + 0.5;
            ctx.beginPath();
            ctx.moveTo(v2, y);
            ctx.lineTo(v2, y + height);
            ctx.stroke();
            const h1 = Math.round(y + height / phi) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, h1);
            ctx.lineTo(x + width, h1);
            ctx.stroke();
            const h2 = Math.round(y + height - height / phi) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, h2);
            ctx.lineTo(x + width, h2);
            ctx.stroke();
        }

        function showError(message) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }

        // Event listeners
        scaleTypeSelect.addEventListener('change', drawScale);
        formatSelect.addEventListener('change', updateOverlayAspect);
        colorInput.addEventListener('input', drawScale);
        loadImageBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', handleImageSelection);
        backToCameraBtn.addEventListener('click', switchToCameraMode);

        container.addEventListener('wheel', (event) => {
            event.preventDefault();
            const factor = event.deltaY < 0 ? 1.1 : 0.9;
            if (formatSelect.value === 'free') {
                if (event.shiftKey) {
                    overlayState.scaleX = clampScale(overlayState.scaleX * factor);
                } else if (event.altKey || event.ctrlKey) {
                    overlayState.scaleY = clampScale(overlayState.scaleY * factor);
                } else {
                    overlayState.scaleX = clampScale(overlayState.scaleX * factor);
                    overlayState.scaleY = clampScale(overlayState.scaleY * factor);
                }
                clampOverlayToCanvas();
                updateHandlePositions();
                drawScale();
                return;
            }
            setOverlayScale(overlayState.scale * factor);
        }, { passive: false });

        container.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            const corner = event.target?.dataset?.corner;
            if (corner) {
                const rect = getOverlayRect();
                gestureStart = {
                    resize: true,
                    corner,
                    anchorX: corner.includes('e') ? rect.centerX - rect.width / 2 : rect.centerX + rect.width / 2,
                    anchorY: corner.includes('s') ? rect.centerY - rect.height / 2 : rect.centerY + rect.height / 2,
                    startX: event.clientX,
                    startY: event.clientY,
                    rect
                };
                container.setPointerCapture(event.pointerId);
                return;
            }

            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (activePointers.size === 1) {
                isPanning = true;
                lastPanPosition = { x: event.clientX, y: event.clientY };
                gestureStart = null;
            } else if (activePointers.size === 2) {
                const [p1, p2] = Array.from(activePointers.values());
                gestureStart = {
                    distance: pointerDistance(p1, p2),
                    distX: Math.abs(p1.x - p2.x),
                    distY: Math.abs(p1.y - p2.y),
                    center: pointerCenter(p1, p2),
                    scale: overlayState.scale,
                    scaleX: overlayState.scaleX,
                    scaleY: overlayState.scaleY,
                    centerX: overlayState.centerX,
                    centerY: overlayState.centerY
                };
                isPanning = false;
            }
            container.setPointerCapture(event.pointerId);
        });

        container.addEventListener('pointermove', (event) => {
            if (gestureStart?.resize) {
                event.preventDefault();
                const gs = gestureStart;
                const ax = gs.anchorX;
                const ay = gs.anchorY;
                const ex = event.clientX;
                const ey = event.clientY;

                let left = Math.min(ax, ex);
                let right = Math.max(ax, ex);
                let top = Math.min(ay, ey);
                let bottom = Math.max(ay, ey);
                let width = Math.max(10, right - left);
                let height = Math.max(10, bottom - top);
                let centerX = (left + right) / 2;
                let centerY = (top + bottom) / 2;

                const aspect = overlayState.aspect;
                if (formatSelect.value !== 'free' && aspect) {
                    // keep aspect
                    const desiredH = width / aspect;
                    if (desiredH <= height) {
                        height = desiredH;
                    } else {
                        width = height * aspect;
                    }
                    const signX = ax > ex ? -1 : 1;
                    const signY = ay > ey ? -1 : 1;
                    centerX = ax + signX * width / 2;
                    centerY = ay + signY * height / 2;
                } else if (formatSelect.value === 'free') {
                    overlayState.scaleX = clampScale(width / overlay.width);
                    overlayState.scaleY = clampScale(height / overlay.height);
                }

                overlayState.centerX = overlay.width ? centerX / overlay.width : 0.5;
                overlayState.centerY = overlay.height ? centerY / overlay.height : 0.5;

                if (formatSelect.value !== 'free' && aspect) {
                    const base = Math.min(overlay.width, overlay.height);
                    if (aspect >= 1) {
                        overlayState.scale = clampScale(width / base);
                    } else {
                        overlayState.scale = clampScale(width / (base * aspect));
                    }
                }

                clampOverlayToCanvas();
                updateHandlePositions();
                drawScale();
                return;
            }

            if (!activePointers.has(event.pointerId)) return;
            event.preventDefault();
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (activePointers.size === 2 && gestureStart) {
                const [p1, p2] = Array.from(activePointers.values());
                const distance = pointerDistance(p1, p2);
                const center = pointerCenter(p1, p2);
                const scaleFactor = distance / gestureStart.distance || 1;
                if (formatSelect.value === 'free' && gestureStart.distX && gestureStart.distY) {
                    const current = Array.from(activePointers.values());
                    const distX = Math.abs(current[0].x - current[1].x) || 1;
                    const distY = Math.abs(current[0].y - current[1].y) || 1;
                    overlayState.scaleX = clampScale(gestureStart.scaleX * (distX / gestureStart.distX));
                    overlayState.scaleY = clampScale(gestureStart.scaleY * (distY / gestureStart.distY));
                } else {
                    overlayState.scale = clampScale(gestureStart.scale * scaleFactor);
                }
                overlayState.centerX = gestureStart.centerX + (center.x - gestureStart.center.x) / overlay.width;
                overlayState.centerY = gestureStart.centerY + (center.y - gestureStart.center.y) / overlay.height;
                clampOverlayToCanvas();
                updateHandlePositions();
                drawScale();
                return;
            }

            if (isPanning && activePointers.size === 1) {
                const current = activePointers.values().next().value;
                const dx = current.x - lastPanPosition.x;
                const dy = current.y - lastPanPosition.y;
                lastPanPosition = { ...current };
                moveOverlay(dx, dy);
            }
        });

        function clearPointer(event) {
            if (gestureStart?.resize && !activePointers.has(event.pointerId)) {
                gestureStart = null;
                return;
            }
            if (activePointers.has(event.pointerId)) {
                activePointers.delete(event.pointerId);
            }
            if (activePointers.size < 2) {
                gestureStart = null;
            }
            if (activePointers.size === 0) {
                isPanning = false;
            }
        }

        container.addEventListener('pointerup', (event) => {
            clearPointer(event);
        });
        container.addEventListener('pointercancel', (event) => {
            clearPointer(event);
        });
        container.addEventListener('pointerleave', (event) => {
            clearPointer(event);
        });

        toggleControlsBtn.addEventListener('click', () => {
            controlsDiv.classList.add('hidden');
            openControlsBtn.classList.add('visible');
        });

        openControlsBtn.addEventListener('click', () => {
            controlsDiv.classList.remove('hidden');
            openControlsBtn.classList.remove('visible');
        });

        switchCameraBtn.addEventListener('click', () => {
            if (mode !== 'camera') return;
            facingMode = facingMode === 'environment' ? 'user' : 'environment';
            initCamera();
        });

        captureBtn.addEventListener('click', captureImage);

        closePreviewBtn.addEventListener('click', () => {
            imagePreviewDiv.classList.remove('visible');
            previewImage.src = '';
        });

        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });

        window.addEventListener('resize', resizeOverlay);
        screen.orientation?.addEventListener('change', resizeOverlay);

        // Start the app
        resizeOverlay();
        initCamera();

        // Redraw scale periodically to keep it smooth
        setInterval(drawScale, 100);
