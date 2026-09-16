import { expect, test } from "vitest";
import { jeton } from "../money";
import { additionalExposureMillis, boxProfitExposureMillis, insuranceProfitExposureMillis } from "./bankroll";

test("3:2 box exposure is 1.5× stake", () => {
  expect(boxProfitExposureMillis(jeton(25), "THREE_TWO")).toBe(jeton("37.5"));
});

test("6:5 box exposure is 1.2× stake", () => {
  expect(boxProfitExposureMillis(jeton(25), "SIX_FIVE")).toBe(jeton(30));
});

test("Insurance exposure is 2× Insurance stake", () => {
  expect(insuranceProfitExposureMillis(jeton(10))).toBe(jeton(20));
});

test("double reserves only the additional exposure", () => {
  const reserved = boxProfitExposureMillis(jeton(25), "THREE_TWO");
  expect(additionalExposureMillis(reserved, jeton(50), "THREE_TWO")).toBe(jeton("37.5"));
});
