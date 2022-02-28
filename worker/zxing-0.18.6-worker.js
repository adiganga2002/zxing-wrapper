const TAG = "[Scan Worker]";

addEventListener("message", async (message) => {
    let event = message.data;
    switch (event.type){
        case "init":
            init(event)
            break;
        case "decode":
            decodeMessage(event);
            break;
        default:
            postMessage({type: "unknown-message"});
    }
});
console.log(TAG, "event listener set up!");

async function init(message){
    let basePath = message.payload.basePath;
    await importScripts(basePath+"../lib/zxing.min.js");

    console.log(TAG, "ready for requests!");
}

function decodeMessage(message){
    const { BrowserMultiFormatReader, HTMLCanvasElementLuminanceSource, BinaryBitmap, BarcodeFormat, HybridBinarizer} = ZXing;

    const hints = new Map();
    const formats = [BarcodeFormat.DATA_MATRIX];

    hints.set(2, formats);
    hints.set(3, true);

    const { filterId, sendImageData } = message.payload;
    let { imageData } = message.payload;

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
            type: "decode-success",
            payload:{
                feedback: { filterId, imageData },
                result
            }
        });
    } catch (error) {
        if(error.name === "R"){
            postMessage({
                type: "decode-fail",
                payload: {
                    imageData,
                    feedback: { filterId, imageData },
                    error: { message: error.message }
                }
            });
        }else{
            console.log(error);
        }
    }
}
