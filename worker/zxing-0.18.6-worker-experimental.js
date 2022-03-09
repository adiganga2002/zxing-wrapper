const TAG = "[Scan Worker Experimental]";

addEventListener("message", async (message) => {
	let event = message.data;
	switch (event.type) {
		case "init":
			await init(event)
			break;
		case "decode":
			diggestMessageForDecode(event);
			break;
		default:
			postMessage({type: "unknown-message"});
	}
});

console.log(TAG, "event listener set up!");

async function init(message) {
	let basePath = message.payload.basePath;
	await importScripts(basePath + "../lib/zxing.min.js");
	await importScripts(basePath + "filters.js");

	console.log(TAG, "ready for requests!");
}

function decode(imageData) {
	const {
		BrowserMultiFormatReader,
		HTMLCanvasElementLuminanceSource,
		BinaryBitmap,
		BarcodeFormat,
		HybridBinarizer
	} = ZXing;

	const hints = new Map();

	hints.set(3, true);

	const canvasMock = {
		width: imageData.width,
		height: imageData.height,
		getContext: () => ({getImageData: () => imageData}),
	};

	const luminanceSource = new HTMLCanvasElementLuminanceSource(canvasMock, imageData.width, imageData.height);
	const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
	const scanner = new BrowserMultiFormatReader(hints);
	return scanner.decodeBitmap(bitmap);
}

function diggestMessageForDecode(message) {

	const {sendImageData} = message.payload;
	let {imageData} = message.payload;

	try {
        let result;
        let lastError;

		for (let index in self.filters) {
			const filter = getFilter(self.filters[index]);
            let imageDataClone = cloneImageData(imageData);
			if (typeof filter === "function") {
				let newImageData = filter({ imageData: imageDataClone });

				try {
					result = decode(newImageData || imageDataClone);
				} catch (error) {
					lastError = error;
					continue;
				}

                if (result) {
                    break;
                }
			}
		}

		if (!sendImageData) {
			imageData = [];
		}

		if (!result) {
			throw lastError;
		}

		postMessage({
			type: "decode-success",
			payload: {
				feedback: {imageData},
				result
			}
		});
	} catch (error) {
		if (error.name === "R" || error.name === "NotFoundException") {
			postMessage({
				type: "decode-fail",
				payload: {
					imageData,
					feedback: {imageData},
					error: {message: error.message}
				}
			});
		} else {
			console.log(error);
		}
	}
}
