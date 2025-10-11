const adminConfig = require('../config/firebase');
const admin = adminConfig.admin || adminConfig;
const storage = admin.storage().bucket();
const { v4: uuidv4 } = require('uuid');

// LOCATION: use in controllers like stationsController.uploadImage
async function uploadBuffer(ownerId, stationId, file) {
    const ext = file.originalname.split('.').pop();
    const path = `owners/${ownerId}/stations/${stationId}/images/${uuidv4()}.${ext}`;
    const blob = storage.file(path);
    await blob.save(file.buffer, { contentType: file.mimetype, public: true });
    const url = `https://storage.googleapis.com/${storage.name}/${path}`;
    return url;
}

module.exports = { uploadBuffer };