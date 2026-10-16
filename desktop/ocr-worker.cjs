const { parentPort } = require('node:worker_threads');
const path = require('node:path');
let engine;
async function getEngine() {
  if (!engine)
    engine = import('@gutenye/ocr-node')
      .then(async ({ default: Ocr }) => {
        const root = path
          .dirname(require.resolve('@gutenye/ocr-models/node'))
          .replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
        return Ocr.create({
          models: {
            detectionPath: path.join(root, 'assets/ch_PP-OCRv4_det_infer.onnx'),
            recognitionPath: path.join(
              root,
              'assets/ch_PP-OCRv4_rec_infer.onnx',
            ),
            dictionaryPath: path.join(root, 'assets/ppocr_keys_v1.txt'),
          },
          onnxOptions: {
            executionProviders: ['cpu'],
            intraOpNumThreads: 2,
            interOpNumThreads: 1,
          },
        });
      })
      .catch((e) => {
        engine = null;
        throw e;
      });
  return engine;
}
parentPort.on('message', async (image) => {
  try {
    parentPort.postMessage({ result: await (await getEngine()).detect(image) });
  } catch (e) {
    parentPort.postMessage({ error: e.message });
  }
});
