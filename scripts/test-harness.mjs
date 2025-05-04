import puppeteer from "puppeteer";
import Webpack from "webpack";
import { fs } from "memfs";

import webpackConfig from "../webpack.config.js";

/**
 * Validate a URL
 * @param {URL} url
 * @returns {boolean}
 */
const validateUrl = (url) => {
  try {
    return new URL(url);
  } catch (_e) {
    return false;
  }
};

if (!process.argv[2]) {
  console.error("Usage: yarn test '<url>'");
  process.exit(1);
}

if (!validateUrl(process.argv[2])) {
  console.error("Invalid URL (hint: include http:// or https://)");
  process.exit(1);
}

const config = webpackConfig({}, { mode: "development" });

const compiler = Webpack(config);
compiler.outputFileSystem = fs;

const browser = await puppeteer.launch({ headless: false, devtools: true });
const page = await browser.newPage();

const _watching = compiler.watch({}, async (err, stats) => {
  if (err) {
    console.error(err);
    console.error("Not opening browser");
    return;
  }
  console.log(
    stats.toString({
      colors: true,
      preset: "summary",
    }),
  );
  const behaviorScript = fs.readFileSync("dist/behaviors.js", "utf8");

  await page.goto(validateUrl(process.argv[2]));

  await page.evaluate(
    behaviorScript +
      `
  self.__bx_behaviors.init({
    autofetch: true,
    autoplay: true,
    autoscroll: true,
    siteSpecific: true,
  });
  `,
  );

  // call and await run on top frame and all child iframes
  await Promise.allSettled(
    page
      .frames()
      .map(async (frame) => frame.evaluate("self.__bx_behaviors.run()")),
  );
});
