import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trucklinkRouter from "./trucklink";

const router: IRouter = Router();

router.use(healthRouter);
router.use(trucklinkRouter);

export default router;
