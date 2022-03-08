/**
 * @param image {ImageData}
 */
function invert(image) {
	for (let i = 0; i < image.data.length; i += 4) {
		image.data[i] = image.data[i] ^ 255;
		image.data[i + 1] = image.data[i + 1] ^ 255;
		image.data[i + 2] = image.data[i + 2] ^ 255;
	}
}

/**
 * @param image {ImageData}
 * @param threshold {number}
 */
function threshold(image, threshold) {
	for (let i = 0; i < image.data.length; i += 4) {
		let value = image.data[i + 1] >= threshold ? 255 : 0
		image.data[i] = value;
		image.data[i + 1] = value;
		image.data[i + 2] = value;
	}
}

/**
 * @param image {ImageData}
 * @returns {Uint16Array}
 */
function computeHistogram(image) {
	const histogram = new Uint16Array(256);
	for (let i = 0; i < image.data.length; i += 4) {
		// Store luma to red-channel for reuse later
		const luma = (image.data[i] = Math.round(
			image.data[i] * 0.2126 + image.data[i + 1] * 0.7152 + image.data[i + 2] * 0.0722
		));
		histogram[luma]++;
	}
	return histogram;
}

/**
 * @param histData {Uint16Array}
 * @param total {number}
 * @returns {number}
 */
function computeOtsuFactor(histData, total) {
	let sum = 0;
	for (let t = 0; t < 256; t++) sum += t * histData[t];

	let sumB = 0;
	let wB = 0;
	let wF = 0;

	let varMax = 0;
	let threshold = 0;

	for (let t = 0; t < 256; t++) {
		wB += histData[t]; // Weight Background
		if (wB === 0) continue;

		wF = total - wB; // Weight Foreground
		if (wF === 0) break;

		sumB += t * histData[t];

		let mB = sumB / wB; // Mean Background
		let mF = (sum - sumB) / wF; // Mean Foreground

		// Calculate Between Class Variance
		let varBetween = wB * wF * (mB - mF) * (mB - mF);

		// Check if new maximum found
		if (varBetween > varMax) {
			varMax = varBetween;
			threshold = t;
		}
	}

	return threshold;
}

const filters = {
	/**
	 * @param props {FilterProps}
	 * @returns {ImageData}
	 */
	default: (props) => {
		return props.imageData;
	},

	/**
	 *
	 * @param props {FilterProps}
	 * @returns {ImageData}
	 */
	otsuThresholding: (props) => {
		const {imageData} = props;
		const histogram = computeHistogram(imageData);
		const otsuFactor = computeOtsuFactor(histogram, imageData.width * imageData.height);
		threshold(imageData, otsuFactor);
		return imageData;
	}
};

self.cloneImageData = function (imageData) {
	let copy = {
		data: Uint8ClampedArray.from(imageData.data),
		width: imageData.width,
		height: imageData.height
	};
	copy.data.set(imageData.data);
	return copy;
}

/**
 *
 * @param id {string}
 * @returns {function(FilterProps): ImageData}
 */
const getFilter = (id) => {
	let isInverted = false;
	let filterName = id;

	if (id.endsWith("Inverted")) {
		isInverted = true;
		filterName = id.slice(0, -8);
	}

	const filter = filters[filterName];

	if (!isInverted) {
		return filter;
	}

	return (props) => {
		const imageData = filter(props);
		invert(imageData);
		return imageData;
	};
};

self.getFilter = getFilter;
self.filters = ["default", "defaultInverted", "otsuThresholding", "otsuThresholdingInverted"];
