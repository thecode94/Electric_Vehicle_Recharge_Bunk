// backend/src/utils/slugify.js
module.exports = function slugify(input = "") {
    return String(input)
        .toLowerCase()
        .trim()
        .replace(/[\s\W]+/g, "-")
        .replace(/^-+|-+$/g, "");
};
