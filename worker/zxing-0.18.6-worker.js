importScripts("lib/zxing.min.js");

const { BrowserMultiFormatReader, MultiFormatReader, HTMLCanvasElementLuminanceSource, BinaryBitmap, BarcodeFormat, DecodeHintType, GlobalHistogramBinarizer, HybridBinarizer} = ZXing;

const hints = new Map();
const formats = [BarcodeFormat.DATA_MATRIX];

hints.set(2, formats);
hints.set(3, true);

addEventListener("message", async (e) => {
    const { filterId, sendImageData } = e.data;
    let { imageData } = e.data;

    const canvasMock = {
        width: imageData.width,
        height: imageData.height,
        getContext: () => ({ getImageData: () => imageData }),
    };

    try {
        const luminanceSource = new HTMLCanvasElementLuminanceSource(canvasMock, imageData.width, imageData.height);
        const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
        const scanner = new BrowserMultiFormatReader(hints);
        const result = scanner.decodeBitmap(bitmap);

        if (!sendImageData) {
            imageData = [];
        }

        postMessage({
            message: "successful decoding",
            feedback: { filterId, imageData },
            data: { result },
        });
    } catch (error) {
        if(error.name === "R"){
            postMessage({
                message: "failed decoding",
                feedback: { filterId, imageData },
                error: { message: error.message },
            });
        }else{
            console.log(error);
        }
    }
});

console.log("Scan Worker ready!");