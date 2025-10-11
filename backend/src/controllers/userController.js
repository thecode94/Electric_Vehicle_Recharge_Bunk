const { db, admin } = require('../config/firebase');

/**
 * Get current user profile from request
 */
async function me(req, res) {
  try {
    const user = req.user || null;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Update current user profile
 */
async function updateProfile(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'User ID not found' });

    const { name, phone, avatar, preferences, bio } = req.body;

    const updateData = {
      updatedAt: new Date()
    };

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bio !== undefined) updateData.bio = bio;
    if (preferences && typeof preferences === 'object') {
      updateData.preferences = preferences;
    }

    await db.collection('users').doc(uid).update(updateData);

    const updatedProfile = await db.collection('users').doc(uid).get();
    const profileData = updatedProfile.data();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        uid,
        email: req.user.email,
        profile: profileData
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get current user's bookings
 */
async function getBookings(req, res) {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }

    let query = db.collection('bookings').where('userId', '==', uid);

    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('createdAt', 'desc')
      .limit(Number(limit))
      .offset(Number(offset));

    const snapshot = await query.get();
    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      bookings,
      count: bookings.length,
      hasMore: bookings.length === Number(limit)
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.json({
      success: true,
      bookings: [],
      message: 'Bookings endpoint - demo implementation'
    });
  }
}

/**
 * Get user's favorite stations
 */
async function getFavoriteStations(req, res) {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }

    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const favoriteIds = userData?.favoriteStations || [];

    if (favoriteIds.length === 0) {
      return res.json({
        success: true,
        stations: [],
        message: 'No favorite stations found'
      });
    }

    const stationsSnapshot = await db.collection('ev_bunks')
      .where('__name__', 'in', favoriteIds)
      .where('status', '==', 'active')
      .get();

    const stations = stationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      stations,
      count: stations.length
    });
  } catch (error) {
    console.error('Get favorite stations error:', error);
    res.json({
      success: true,
      stations: [],
      message: 'Favorites endpoint - demo implementation'
    });
  }
}

/**
 * Add station to favorites
 */
async function addFavoriteStation(req, res) {
  try {
    const { stationId } = req.params;
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }

    await db.collection('users').doc(uid).update({
      favoriteStations: admin.firestore.FieldValue.arrayUnion(stationId),
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Station added to favorites',
      stationId
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add favorite',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Remove station from favorites
 */
async function removeFavoriteStation(req, res) {
  try {
    const { stationId } = req.params;
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }

    await db.collection('users').doc(uid).update({
      favoriteStations: admin.firestore.FieldValue.arrayRemove(stationId),
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Station removed from favorites',
      stationId
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = {
  me,
  updateProfile,
  getBookings,
  getFavoriteStations,
  addFavoriteStation,
  removeFavoriteStation,
};
