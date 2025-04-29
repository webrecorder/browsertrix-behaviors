import puppeteer from "puppeteer";
import Webpack from "webpack";
import { fs } from "memfs";

import webpackConfig from "../webpack.config.js";
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

  await page.goto(process.argv[2]);

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
