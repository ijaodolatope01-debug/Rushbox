import { create_errandlr as errandlr, webhook_errandlr } from "./errandlr.js";
import { create_chowdeck as chowdeck, webhook_chowdeck } from "./chowdeck.js";
import { create_fez as fez, webhook_fez } from "./fez.js";
import { create_kwik as kwik, webhook_kwik } from "./kwik.js";
import { create_dellyman as dellyman, webhook_dellyman } from "./dellyman.js";
import { create_kwikpik as kwikpik, webhook_kwikpik } from "./kwikpik.js";

export const courierStrategies = {
  errandlr,
  chowdeck,
  fez,
  kwik,
  dellyman,
  kwikpik,
};

export const webhook_courier = {
  errandlr: webhook_errandlr,
  fez: webhook_fez,
  chowdeck: webhook_chowdeck,
  dellyman: webhook_dellyman,
  kwik: webhook_kwik,
  kwikpik: webhook_kwikpik,
};
