import express from "express";
import seoController from "../controllers/seoController.js";

const router = express.Router();

/**
 * @route GET /robots.txt
 * @desc Get professional crawler instructions
 */
router.get("/robots.txt", seoController.getRobots);

/**
 * @route GET /sitemap.xml
 * @desc Get dynamic sitemap
 */
router.get("/sitemap.xml", seoController.getSitemap);

/**
 * @route GET /.well-known/security.txt
 * @route GET /security.txt
 * @desc Enterprise vulnerability disclosure standard
 */
router.get(["/.well-known/security.txt", "/security.txt"], seoController.getSecurityTxt);

export default router;
