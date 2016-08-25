import * as byots  from "byots";
const ensureImport = byots;

import * as sw from "../../utils/simpleWorker";
import * as types from "../../../common/types";
import * as contract from "./testedContract";
import {resolve} from "../../../common/utils";
import * as fsu from "../../utils/fsu";
import {parse, parseErrorToCodeError} from "../../../common/json";
import * as utils from "../../../common/utils";

const testedMessagePrefix = `[TESTED]`;

namespace Worker {
    export const fileSaved: typeof contract.worker.fileSaved = (data) => {
        /** TODO: tested file saved */

        if (data.filePath.toLowerCase().endsWith('tested.json')){
            TestedWorkerImplementation.restart();
        }

        return resolve({});
    }
}

// Ensure that the namespace follows the contract
const _checkTypes: typeof contract.worker = Worker;
// run worker
export const {master} = sw.runWorker({
    workerImplementation: Worker,
    masterContract: contract.master
});

import {ErrorsCache} from "../../utils/errorsCache";


namespace TestedWorkerImplementation {
    type TestedJsonRaw = {
        tests: {
            include?: string[],
            exclude?: string[],
        }
    }

    type TestedJson = {
        filePaths: string[];
    }

    /** Init errors */
    const errorCache = new ErrorsCache();
    errorCache.errorsDelta.on(master.receiveErrorCacheDelta);

    /** Init global state */
    let globalState = {
        started: false,
        testedJson: {
            filePaths: []
        }
    }

    /**
     * Reinit the global state + errors
     */
    function reinit() {
        errorCache.clearErrors();
        globalState = {
            started: false,
            testedJson: {
                filePaths: []
            }
        }
    }

    /**
     * Restart if:
     * - tested.json changes
     * - working directory changes
     */
    export function restart() {
        reinit();
        let testedJsonFilePath: string;
        try {
            testedJsonFilePath = fsu.travelUpTheDirectoryTreeTillYouFind(process.cwd(), 'tested.json');
        }
        catch (err) {
            // Leave disabled
            return;
        }

        // Validate tested.json
        const parsed = parse<TestedJsonRaw>(fsu.readFile(testedJsonFilePath));
        if (parsed.error){
            errorCache.setErrorsByFilePaths(
                [testedJsonFilePath],
                [parseErrorToCodeError(testedJsonFilePath,parsed.error)]
            );
            return;
        }

        /** Sanitize raw data */
        const rawData = parsed.data;
        rawData.tests = rawData.tests || {
        };
        rawData.tests.include = rawData.tests.include || ["./**/*.ts", "./**/*.tsx"],
        rawData.tests.exclude = rawData.tests.exclude || ["node_modules"];

        /** Expand the filePaths */
        const filePaths = expandIncludeExclude(utils.getDirectory(testedJsonFilePath),rawData.tests);

        /** Good to go */
        globalState.started = true;
        globalState.testedJson = {
            filePaths
        };

        console.log(testedMessagePrefix, "File count:", filePaths.length);
    }

    /** TODO: tested run tests with cancellation token */
}

/**
 * As soon as the worker starts up we do an initial start
 */
TestedWorkerImplementation.restart();

/** Utility: include / exclude expansion */
function expandIncludeExclude(rootDir: string, cfg: { include?: string[], exclude?: string[] }): string[] {
    const tsResult = ts.parseJsonConfigFileContent(
        {
            compilerOptions: {
                allowJs: true
            },
            include: cfg.include,
            exclude: cfg.exclude
        },
        ts.sys,
        rootDir
    );
    // console.log(tsResult); // DEBUG
    return tsResult.fileNames || [];
}