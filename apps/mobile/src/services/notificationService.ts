import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DAILY_REMINDER_ID = 'uangku_daily_reminder_v1';
const BILL_REMINDER_PREFIX = 'uangku_bill_reminder_';

export class NotificationService {
  /**
   * Request notification permissions from iOS / Android
   */
  public static async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Pengingat Keuangan UangKu',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#D4AF37',
        });
      }

      return true;
    } catch (err) {
      console.warn('Failed to request notification permissions:', err);
      return false;
    }
  }

  /**
   * Schedule daily expense recording reminder at 20:00 (PRD Section 62)
   */
  public static async scheduleDailyReminder(hour = 20, minute = 0): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return false;

      // Cancel existing reminder if any
      await this.cancelDailyReminder();

      await Notifications.scheduleNotificationAsync({
        identifier: DAILY_REMINDER_ID,
        content: {
          title: 'Waktunya Catat Keuangan Hari Ini',
          body: 'Sudahkah kamu mencatat pengeluaranmu hari ini? Jaga stabilitas finansialmu bersama UangKu.',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });

      return true;
    } catch (err) {
      console.warn('Failed to schedule daily reminder:', err);
      return false;
    }
  }

  /**
   * Cancel daily expense recording reminder
   */
  public static async cancelDailyReminder(): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
    } catch (err) {
      console.warn('Failed to cancel daily reminder:', err);
    }
  }

  /**
   * Schedule bill reminder for recurring expenses (PRD Section 62)
   */
  public static async scheduleBillReminder(ruleId: string, title: string, amountStr: string, date: Date): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      const identifier = `${BILL_REMINDER_PREFIX}${ruleId}`;
      await Notifications.cancelScheduledNotificationAsync(identifier);

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: `Tagihan Jatuh Tempo: ${title}`,
          body: `Tagihan sebesar ${amountStr} jatuh tempo hari ini. Buka UangKu untuk verifikasi pembayaran.`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });
    } catch (err) {
      console.warn('Failed to schedule bill reminder:', err);
    }
  }
}
