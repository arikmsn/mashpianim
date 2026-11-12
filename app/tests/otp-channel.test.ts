import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isOtpChannel,
  defaultOtpChannel,
  resolveOtpChannel,
  otherOtpChannel,
  otpChannelLabel,
  otpSmsText,
  toE164,
  isValidTwilioSender,
  OTP_SMS_MAX_CHARS,
} from "../src/lib/otp-channel.ts";

describe("login code channel (WhatsApp / SMS, owner 2026-11-12)", () => {
  test("the env switch picks the default; the client's valid choice wins", () => {
    assert.equal(defaultOtpChannel(undefined), "whatsapp");
    assert.equal(defaultOtpChannel(""), "whatsapp");
    assert.equal(defaultOtpChannel("SMS "), "sms");
    assert.equal(defaultOtpChannel("whatsapp"), "whatsapp");
    assert.equal(resolveOtpChannel("sms", undefined), "sms");
    assert.equal(resolveOtpChannel("whatsapp", "sms"), "whatsapp");
    assert.equal(resolveOtpChannel("pigeon", "sms"), "sms", "junk → the configured default");
    assert.equal(resolveOtpChannel(undefined, undefined), "whatsapp");
    assert.equal(isOtpChannel("sms"), true);
    assert.equal(isOtpChannel("email"), false);
  });

  test("the other channel and its Hebrew label", () => {
    assert.equal(otherOtpChannel("whatsapp"), "sms");
    assert.equal(otherOtpChannel("sms"), "whatsapp");
    assert.equal(otpChannelLabel("sms"), "ב-SMS");
    assert.equal(otpChannelLabel("whatsapp"), "בוואטסאפ");
  });

  test("the SMS fits one UCS-2 segment, carries the code, and has no link or emoji", () => {
    const text = otpSmsText("483921");
    assert.ok(text.includes("483921"));
    assert.ok(text.length <= OTP_SMS_MAX_CHARS, `${text.length} chars`);
    assert.doesNotMatch(text, /https?:\/\//);
    assert.doesNotMatch(text, /[\u{1F300}-\u{1FAFF}]/u);
    assert.match(text, /משפיען אונליין/);
  });

  test("the Twilio sender: an E.164 number or an alphanumeric id of up to 11 letters/digits", () => {
    assert.equal(isValidTwilioSender("Mashpian"), true);
    assert.equal(isValidTwilioSender("Mashpian On"), true, "11 chars with a space");
    assert.equal(isValidTwilioSender("+15005550006"), true);
    assert.equal(isValidTwilioSender("Mashpian_Online"), false, "underscore and 15 chars (the value first entered in Vercel)");
    assert.equal(isValidTwilioSender("MashpianOnline"), false, "14 chars");
    assert.equal(isValidTwilioSender("123456"), false, "needs a letter when alphanumeric");
    assert.equal(isValidTwilioSender(""), false);
    assert.equal(isValidTwilioSender(undefined), false);
  });

  test("E.164 for Twilio", () => {
    assert.equal(toE164("972501234567"), "+972501234567");
    assert.equal(toE164("+972501234567"), "+972501234567");
    assert.equal(toE164("+972-50-123-4567"), "+972501234567");
    assert.equal(toE164(""), null);
    assert.equal(toE164(null), null);
    assert.equal(toE164("12"), null);
  });
});
