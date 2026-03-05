// backend/utils/pushNotification.js
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

/**
 * Send push notification via Expo
 * @param {string} pushToken - Expo push token
 * @param {object} options - { title, body, data, channelId }
 */
export const sendPushNotification = async (pushToken, options) => {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn('⚠️ Invalid Expo push token:', pushToken);
    return { success: false, error: 'Invalid token' };
  }

  const { title, body, data = {}, channelId = 'default' } = options;

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
    channelId,           // ✅ CRITICAL for Android
    priority: 'high',    // ✅ CRITICAL for delivery
    badge: 1,
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (let chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    console.log('✅ Push notification sent:', tickets[0]);
    return { success: true, tickets };

  } catch (error) {
    console.error('❌ Push notification failed:', error);
    return { success: false, error: error.message };
  }
};

export default { sendPushNotification };