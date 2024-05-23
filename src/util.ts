export async function asyncTimeout(duration: number, promise: Promise<any | undefined>) {
    let timer: NodeJS.Timeout;
    let timerPromise = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(`Promise timed out after ${duration} ms.`), duration);
    });

    return Promise.race([
        promise,
        timerPromise
    ]).finally(() => {
        clearTimeout(timer);
    });
}

export function isValidMagnetLink(input: string): boolean {
    return (input.match(/magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32}/i) !== null);
}