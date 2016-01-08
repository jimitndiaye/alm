import * as sw from "../../utils/simpleWorker";
import * as contract from "./fileListingContract";

import {TypedEvent} from "../../../common/events";
import * as workingDir from "../../disk/workingDir";
import * as types from "../../../common/types";

export var filePathsUpdated = new TypedEvent<{ filePaths: types.FilePath[]; rootDir: string; completed: boolean;}>();
export var filePathsCompleted = new TypedEvent<{ filePaths: types.FilePath[]; rootDir: string; completed: boolean;}>();

namespace Master {
    export var increment: typeof contract.master.increment = (q) => {
        return Promise.resolve({
            num: ++q.num
        });
    }
    /** warning, this function is named differently from the event filePathsUpdated for a reason */
    export var fileListUpdated: typeof contract.master.fileListUpdated = (q) => {
        filePathsUpdated.emit({ filePaths: q.filePaths, rootDir: workingDir.getProjectRoot(), completed:q.completed });
        if (q.completed){
            filePathsCompleted.emit({ filePaths: q.filePaths, rootDir: workingDir.getProjectRoot(), completed:q.completed });
        }
        return Promise.resolve({});
    }
}

// Ensure that the namespace follows the contract
var _checkTypes: typeof contract.master = Master;
// launch worker
export var {worker} = sw.startWorker(__dirname + '/fileListingWorker', contract.worker, Master);

export function start() {
    worker.setupWatch({ directory: workingDir.getProjectRoot() });
}
