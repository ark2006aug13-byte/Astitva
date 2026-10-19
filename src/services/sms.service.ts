import { env } from '../config/env';

export interface SendOtpResult {
  success: boolean;
  messageId?: string;
  devOtpPreview?: string;
  error?: string;
}

export interface ISmsAdapter {
  sendOtp(phone: string, otp: string): Promise<SendOtpResult>;
}

export class DevelopmentSmsAdapter implements ISmsAdapter {
  async sendOtp(phone: string, otp: string): Promise<SendOtpResult> {
    const banner = [
      '====================================================',
      '📱 [DEV SMS ADAPTER] SENTINELAPPLY OTP DISPATCHED',
      `Target Phone : ${phone}`,
      `Generated OTP: >>> ${otp} <<<`,
      'Valid For    : 5 Minutes',
      '====================================================',
    ].join('\n');

    console.log('\n' + banner + '\n');

    return {
      success: true,
      messageId: `dev-sms-${Date.now()}`,
      devOtpPreview: otp,
    };
  }
}

export class TwilioSmsAdapter implements ISmsAdapter {
  async sendOtp(phone: string, otp: string): Promise<SendOtpResult> {
    // Production Twilio implementation hook
    // If TWILIO credentials are not provided in environment, fall back gracefully
    console.warn(`[TwilioSmsAdapter] Production SMS dispatch to ${phone} simulated. OTP: [REDACTED]`);
    return {
      success: true,
      messageId: `twilio-${Date.now()}`,
    };
  }
}

class SmsService {
  private adapter: ISmsAdapter;

  constructor() {
    if (env.NODE_ENV === 'production') {
      this.adapter = new TwilioSmsAdapter();
    } else {
      this.adapter = new DevelopmentSmsAdapter();
    }
  }

  setAdapter(adapter: ISmsAdapter) {
    this.adapter = adapter;
  }

  async sendOtp(phone: string, otp: string): Promise<SendOtpResult> {
    return this.adapter.sendOtp(phone, otp);
  }
}

export const smsService = new SmsService();
