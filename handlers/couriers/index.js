import { create_errandlr as errandlr } from "./errandlr.js";
import { create_chowdeck as chowdeck } from "./chowdeck.js";
import { create_fez as fez } from "./fez.js";
import { create_kwik as kwik } from "./kwik.js";
import { create_dellyman as dellyman } from "./dellyman.js";
import { create_kwikpik as kwikpik } from "./kwikpik.js";

export const courierStrategies = {
  errandlr,
  chowdeck,
  fez,
  kwik,
  dellyman,
  kwikpik,
};
