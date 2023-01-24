import { FetchProgressEvent } from './interfaces';

export function responseToProgressStream(response: Response): ReadableStream {
  if (!response.body) throw new Error('Response has no body');

  const reader = response.body.getReader();
  const lengthString = response.headers.get('Content-Length');
  const length = lengthString !== null ? parseInt(lengthString) : Infinity;

  let bytesReceived = 0;

  // take each received chunk and emit an event, pass through to new stream which will be read as text
  return new ReadableStream({
    start(controller) {
      // The following function handles each data chunk
      function push(): void {
        // "done" is a Boolean and value a "Uint8Array"
        reader.read().then(({ done, value }) => {
          // If there is no more data to read
          if (done) {
            controller.close();
            return;
          }

          bytesReceived += value.length;
          window.dispatchEvent(
            new CustomEvent<FetchProgressEvent>('flamerouter:fetch-progress', {
              detail: {
                // length may be NaN if no Content-Length header was found
                progress: (bytesReceived / length) * 100,
                received: bytesReceived,
                length: length || 0,
              },
            }),
          );
          // Get the data and send it to the browser via the controller
          controller.enqueue(value);
          // Check chunks by logging to the console
          push();
        });
      }

      push();
    },
  });
}
