const WORKER_SCRIPT_PATH = "worker/zxing-0.18.6-worker.js";
const SCAN_AREA_SIZE = 250;

export default function Scanner(domElement) {

	let canvas;
	let context;
	let videoTag;
	let videoStream;
	let worker;
	let workerPath = WORKER_SCRIPT_PATH;
	let scanAreaSize = SCAN_AREA_SIZE;

	let strokeColor = "#000000";

	this.setup = async () => {
		internalSetup();
		return await connectCamera();
	}

	this.scan = async () => {
		let frame = getDataForScanning();
		let result = await decode(frame);
		if (result) {
			strokeColor = "#008000";
		}else{
			strokeColor = "#000000";
		}
		return result;
	}

	this.scanImageData = async (imageData) => {
		//todo: crop if needed the image....
		let result = await decode(imageData);
		return result;
	}

	this.changeWorker = (path) => {
		workerPath = path;
	}

	this.setScanAreaSize = (size) => {
		scanAreaSize = size;
	}

	function internalSetup() {
		let id = "scene"
		if (!domElement.querySelector("#" + id)) {
			canvas = document.createElement("canvas");
			canvas.id = id;
			context = canvas.getContext("2d");
			context.imageSmoothingEnabled = false;

			canvas.setAttribute("style", "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);");
			domElement.append(canvas);
		}
	}

	const getCenterArea = () => {
		let size = scanAreaSize;
		let {width, height} = canvas;
		const points = [(width - size) / 2, (height - size) / 2, size, size];
		return points;
	}

	const decode = (imageData) => {
		let promise = new Promise((resolve, reject) => {
			if (!worker) {
				worker = new Worker(workerPath);
			}

			let waitFor = (message) => {
				try {
					//verify message
					let result;
					let payload = message.data;
					let messageType = payload.message;
					switch (messageType) {
						case "failed decoding":
							//console.log("got an message with failed decoding status");
							break;
						case "successful decoding":
							result = payload.data.result;
							break;
						default:
							console.log("Caught a strange message");
							result = payload;
					}

					worker.removeEventListener("message", waitFor);
					worker.removeEventListener("error", errorHandler);
					resolve(result);
				} catch (err) {
					console.log(err);
				}
			}

			let errorHandler = (...args) => {
				worker = undefined;
				reject(...args);
			};

			worker.addEventListener("message", waitFor);

			worker.addEventListener("error", errorHandler);

			worker.postMessage({
				message: "start decoding",
				imageData,
				filterId: ""
			});
		});

		return promise;
	}

	const connectCamera = async () => {
		return new Promise(async (resolve, reject) => {
			let stream;
			let constraints = {
				audio: false,
				video: {
					facingMode: "environment"
				},
				advanced: [{focusMode: "continuous"}]
			};

			try {
				stream = await navigator.mediaDevices.getUserMedia(constraints);
				const track = stream.getVideoTracks()[0];
				const capabilities = track.getCapabilities();
				console.log(capabilities);

				constraints.video.height = 1080;
				constraints.video.width = 1920;

				await track.applyConstraints(constraints.video);
			} catch (error) {
				console.log("Caught an error during camera connection", error);
				reject();
			}

			let video = document.createElement('video');
			video.autoplay = true;
			video.muted = true;
			video.loop = true;
			if (!gotFullSupport()) {
				video.width = 1;
				video.height = 1;
				video.setAttribute("playsinline", "");
			}
			video.addEventListener("loadeddata", (...args) => {
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				setInterval(drawFrame, 30);
				resolve(true);
			});

			video.addEventListener("error", reject);
			videoTag = video;

			videoStream = stream;
			video.srcObject = stream;

			//enable autoplay video for Safari desktop and mobile
			if (!gotFullSupport()) {
				domElement.append(video);
			}
		});
	}

	const getDataForScanning = () => {
		let frameAsImageData = context.getImageData(...getCenterArea());

		return frameAsImageData;
	}
	const drawCenterArea = () => {
		context.lineWidth = 3;
		context.strokeStyle = strokeColor;
		const centerAreaPoints = getCenterArea();
		context.strokeRect(...centerAreaPoints);
	}

	const drawOverlay = () => {
		let size = scanAreaSize;
		const {width, height} = canvas;

		const x = (width - size) / 2;
		const y = (height - size) / 2;

		const backgroundPoints = [
			{x: width, y: 0},
			{x: width, y: height},
			{x: 0, y: height},
			{x: 0, y: 0},
		];

		const holePoints = [
			{x, y: y + size},
			{x: x + size, y: y + size},
			{x: x + size, y},
			{x, y}
		];

		context.beginPath();

		context.moveTo(backgroundPoints[0].x, backgroundPoints[0].y);
		for (let i = 0; i < 4; i++) {
			context.lineTo(backgroundPoints[i].x, backgroundPoints[i].y);
		}

		context.moveTo(holePoints[0].x, holePoints[0].y);
		for (let i = 0; i < 4; i++) {
			context.lineTo(holePoints[i].x, holePoints[i].y);
		}

		context.closePath();

		context.fillStyle = 'rgba(0, 0, 0, 0.5)'
		context.fill();
	}

	const drawFrame = async () => {
		//context.filter = 'brightness(1.75) contrast(1) grayscale(1)';
		const frame = await grabFrameFromStream();
		if (!frame) {
			console.log("Dropping frame");
			return;
		}

		const {width, height} = canvas;

		context.drawImage(frame, 0, 0, width, height);

		drawOverlay();

		drawCenterArea();
	}

	const grabFrameFromStream = async () => {
		if (!gotFullSupport()) {
			return grabFrameAlternative();
		}

		let frame;
		try {
			const track = videoStream.getVideoTracks()[0];
			const imageCapture = new ImageCapture(track);
			frame = await imageCapture.grabFrame();
		} catch (err) {
			console.log("Got a situation during grabFrame from stream process.", err);
		}
		return frame;
	}

	const gotFullSupport = () => {
		return !!window.ImageCapture;
		//return false;
	}

	const grabFrameAlternative = () => {
		let tempCanvas = document.createElement("canvas");
		let tempContext = tempCanvas.getContext("2d");
		let {width, height} = canvas;
		tempCanvas.width = width;
		tempCanvas.height = height;

		tempContext.drawImage(videoTag, 0, 0, width, height);
		return tempCanvas;
	}
}