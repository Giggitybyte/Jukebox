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

export function convertSeconds(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60


    if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds && `${remainingSeconds}s`}`
    } else if (!hours && minutes > 0) {
        return `${minutes} ${remainingSeconds && `: ${remainingSeconds}s`}`
    } else {
        return `${remainingSeconds}s`
    }
}

export function convertTicks(ticks: number) { // TODO: add seconds
    return {
        days: Math.floor(ticks / (24 * 60 * 60 * 10000000)),
        hours: Math.floor((ticks / (60 * 60 * 10000000)) % 24),
        minutes: Math.round((ticks / (60 * 10000000)) % 60)
    };
}

export function isValidMagnetLink(input: string): boolean {
    return (input.match(/magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32}/i) !== null);
}