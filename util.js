const tryParseFloat = (str) => {
	const out = parseFloat(str);
	if (isNaN(out)) return str;
	else return out;
};

const stripQuotes = (str) => {
	return str.replace(/[\s*\\"\s*]*/gm, ``);
};

module.exports = {
	tryParseFloat,
	stripQuotes
};
