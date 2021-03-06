import Logger from "./logger";

// Result was created to solve the problem of constantly throwing and catching
// errors in the node.js promise ecosystem. Instead of throwing an error, we
// prefer that the user return an instance of the Result class, whose values
// and methods reflect success/failure and any success/failure values.
export default class Result<TSuccess> {
    value: TSuccess;
    error?: Error;
    isError: boolean;

    public static Success<T>(success: T) {
        return new Result<T>(success, false);
    }

    // this method also logs an error in order to facilitate fast,easy logging
    public static Failure(error: string, errorCode?: number) {
        Logger.error(error);
        return new Result<any>(null, true, new Error(error, errorCode));
    }

    public static SilentFailure(error: string, errorCode?: number) {
        return new Result<any>(null, true, new Error(error, errorCode));
    }

    public static Error(e: Error) {
        return new Result<any>(null, true, e)
    }


    public static Pass(res:Result<any>) {
        return res;
    }


    constructor(
        value: TSuccess,
        isError: boolean,
        error?: Error
    ) {
        this.value = value;
        this.isError = isError;
        if (error) this.error = error
    }

}

class Error {
    error: string;
    errorCode: number = 500;

    constructor(error: string, errorCode?: number) {
        this.error = error;
        if (errorCode) this.errorCode = errorCode
    }
}

// Pre-built error classes might come in handy in a few situations. Consider adding
// your own error if you find yourself typing the same thing over and over.
export const ErrorNotFound = new Error('resource not found', 404);
export const ErrorUnauthorized = new Error('unauthorized', 400);
