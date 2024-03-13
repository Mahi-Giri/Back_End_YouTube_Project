import { Router } from "express";
import { registerUser } from "../controllers/user.controllers.js";

const router = Router();

router.route("/register").post(registerUser);
//  
router.route("/login").post(registerUser);
// http://localhost:8000/api/v1/users/login

export default router;
