import routesv1 from "./router-v1.js";
import routesv2 from "./router-v2.js";

let router = async (gp) => {
  await gp.add_router("v1", routesv1, { is_old: true });
  await gp.add_router("v2", routesv2);
};

export default router;
