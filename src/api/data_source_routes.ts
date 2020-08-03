import {Request, Response, NextFunction, Application} from "express"
import {UserT} from "../types/user_management/userT";
import {authInContainer} from "./middleware";
import {
    DataSourceUploadFile,
    ManualJsonImport,
    NewDataSource,
    SetDataSourceActive,
    SetDataSourceConfiguration
} from "../api_handlers/data_source";
import DataSourceStorage from "../data_storage/import/data_source_storage";
import ImportStorage from "../data_storage/import/import_storage";
import TypeMappingStorage from "../data_storage/import/type_mapping_storage";
import DataStagingStorage from "../data_storage/import/data_staging_storage";
import {Readable} from "stream";
const Busboy = require('busboy');
const fileUpload = require('express-fileupload')

// This contains all routes pertaining to DataSources and type mappings.
export default class DataSourceRoutes {
    public static mount(app: Application, middleware:any[]) {
        app.post("/containers/:id/import/datasources",...middleware, authInContainer("write", "data"),this.createDataSource);
        app.get("/containers/:id/import/datasources",...middleware, authInContainer("read", "data"),this.listDataSources);
        app.get("/containers/:id/import/datasources/:sourceID",...middleware, authInContainer("read", "data"),this.retrieveDataSource);
        app.put("/containers/:id/import/datasources/:sourceID",...middleware, authInContainer("read", "data"),this.setConfiguration);
        app.delete("/containers/:id/import/datasources/:sourceID",...middleware, authInContainer("read", "data"),this.deleteDataSource);

        app.post("/containers/:id/import/datasources/:sourceID/active",...middleware, authInContainer("read", "data"),this.setActive);
        app.delete("/containers/:id/import/datasources/:sourceID/active",...middleware, authInContainer("read", "data"),this.setInactive);

        app.get("/containers/:id/import/datasources/:sourceID/imports",...middleware, authInContainer("read", "data"),this.listDataSourcesImports);
        app.post("/containers/:id/import/datasources/:sourceID/imports",...middleware, fileUpload({limits:{fileSize: 50 * 1024 *1024}}), authInContainer("write", "data"),this.createManualJsonImport);

        app.post('/containers/:id/import/datasources/:sourceID/files', ...middleware, authInContainer("write", "data"), this.uploadFile)

        app.post('/containers/:id/import/datasources/:sourceID/mappings', ...middleware, authInContainer("write", "data"), this.createTypeMapping)
        app.get('/containers/:id/import/datasources/:sourceID/mappings/unmapped', ...middleware, authInContainer("read", "data"), this.getUnmappedData)
        app.get('/containers/:id/import/datasources/:sourceID/mappings/unmapped/count', ...middleware, authInContainer("read", "data"), this.countUnmappedData)
        app.put('/containers/:id/import/datasources/:sourceID/mappings/:mappingID', ...middleware, authInContainer("write", "data"), this.updateTypeMapping)
        app.get('/containers/:id/import/datasources/:sourceID/mappings/:mappingID', ...middleware, authInContainer("write", "data"), this.retrieveTypeMapping)
        app.delete('/containers/:id/import/datasources/:sourceID/mappings/:mappingID', ...middleware, authInContainer("write", "data"), this.deleteTypeMapping)


    }

    private static createDataSource(req: Request, res: Response, next: NextFunction) {
        NewDataSource(req.user as UserT,req.params.id, req.body)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.status(201).json(result)
            })
            .catch((err) => res.status(500).send(err))
            .finally(() => next())
    }

    private static setConfiguration(req: Request, res: Response, next: NextFunction) {
        SetDataSourceConfiguration(req.user as UserT,req.params.sourceID, req.body)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.status(201).json(result)
            })
            .catch((err) => res.status(500).send(err))
            .finally(() => next())
    }

    private static retrieveDataSource(req: Request, res: Response, next: NextFunction) {
        DataSourceStorage.Instance.Retrieve(req.params.sourceID)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                // TODO: slightly hacky, might be a better way of doing this.
                // this is needed to remove encrypted data from the return
                if(result.value.config) {
                    // @ts-ignore
                    delete result.value.config.token
                    // @ts-ignore
                    delete result.value.config.username
                    // @ts-ignore
                    delete result.value.config.password
                }

                res.status(200).json(result)
            })
            .catch((err) => {
                res.status(404).send(err)
            })
            .finally(() => next())
    }

    private static setActive(req: Request, res: Response, next: NextFunction) {
        SetDataSourceActive(req.params.sourceID)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.sendStatus(200)
            })
            .catch((err) => res.status(404).send(err))
            .finally(() => next())
    }

    private static setInactive(req: Request, res: Response, next: NextFunction) {
        DataSourceStorage.Instance.SetInactive(req.params.sourceID)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.sendStatus(200)
            })
            .catch((err) => {
                res.status(404).send(err)
            })
            .finally(() => next())
    }

    // getUnmappedData should return a single data_staging record so that a user can have
    // an example payload upon which to build a type mapping
    private static getUnmappedData(req: Request, res: Response, next: NextFunction) {
        DataStagingStorage.Instance.ListUnprocessedByDataSource(req.params.sourceID, 0, 1)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.status(200).json(result)
            })
            .catch((err) => res.status(404).send(err))
            .finally(() => next())
    }

    private static countUnmappedData(req: Request, res: Response, next: NextFunction) {
        DataStagingStorage.Instance.CountUnprocessedByDataSource(req.params.sourceID)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.status(200).json(result)
            })
            .catch((err) => res.status(404).send(err))
            .finally(() => next())
    }

    private static listDataSources(req: Request, res: Response, next: NextFunction) {
        DataSourceStorage.Instance.ListForContainer(req.params.id)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                for(const i in result.value) {
                    // TODO: slightly hacky, might be a better way of doing this.
                    // this is needed to remove encrypted data from the return
                    if(result.value[i].config) {
                        // @ts-ignore
                        delete result.value[i].config.token
                        // @ts-ignore
                        delete result.value[i].config.username
                        // @ts-ignore
                        delete result.value[i].config.password
                    }

                }

                res.status(200).json(result)
            })
            .catch((err) => {
                res.status(404).send(err)
            })
            .finally(() => next())
    }

    private static listDataSourcesImports(req: Request, res: Response, next: NextFunction) {

        ImportStorage.Instance.List(req.params.sourceID, +req.query.offset, +req.query.limit)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.status(200).json(result)
            })
            .catch((err) => res.status(404).send(err))
            .finally(() => next())
    }

    // creeateManualImport will accept either a file or a raw JSON body
    // TODO: set a file size limit that corresponds to the single column data limit of postgres
    private static createManualJsonImport(req: Request, res: Response, next: NextFunction) {
        if(Object.keys(req.body).length !== 0) {
            ManualJsonImport(req.user as UserT, req.params.sourceID, req.body)
                .then((result) => {
                    if (result.isError && result.error) {
                        res.status(result.error.errorCode).json(result);
                        return
                    }

                    res.status(200).json(result)
                })
                .catch((err) => res.status(404).send(err))
                .finally(() => next())
        } else {
            // @ts-ignore
            ManualJsonImport(req.user as UserT, req.params.sourceID, JSON.parse(req.files.import.data))
                .then((result) => {
                    if (result.isError && result.error) {
                        res.status(result.error.errorCode).json(result);
                        return
                    }

                    res.status(200).json(result)
                })
                .catch((err) => res.status(404).send(err))
                .finally(() => next())
        }
    }

    private static deleteDataSource(req: Request, res: Response, next: NextFunction) {
        DataSourceStorage.Instance.PermanentlyDelete(req.params.sourceID)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }
                res.sendStatus(200)
            })
            .catch((err) => res.status(500).send(err))
            .finally(() => next())
    }

    private static createTypeMapping(req: Request, res: Response, next: NextFunction) {
        TypeMappingStorage.Instance.Create(req.params.id, req.params.sourceID, (req.user as UserT).id!, req.body)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.status(201).json(result)
            })
            .catch((err) => res.status(500).send(err))
            .finally(() => next())
    }

    private static updateTypeMapping(req: Request, res: Response, next: NextFunction) {
        TypeMappingStorage.Instance.Update(req.params.mappingID, (req.user as UserT).id!, req.body)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.status(201).json(result)
            })
            .catch((err) => res.status(500).send(err))
            .finally(() => next())
    }

    private static retrieveTypeMapping(req: Request, res: Response, next: NextFunction) {
        TypeMappingStorage.Instance.Retrieve(req.params.mappingID)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }

                res.status(200).json(result)
            })
            .catch((err) => res.status(404).send(err))
            .finally(() => next())
    }



    private static deleteTypeMapping(req: Request, res: Response, next: NextFunction) {
        TypeMappingStorage.Instance.PermanentlyDelete(req.params.mappingID)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }
                res.sendStatus(200)
            })
            .catch((err) => res.status(500).send(err))
            .finally(() => next())
    }

    private static uploadFile(req: Request, res: Response, next: NextFunction) {
        const fileNames: string[] = []
        const busboy = new Busboy({headers: req.headers})
        const metadata: {[key: string]: any} = {}
        let metadataFieldCount = 0;

        // upload the file to the relevant file storage provider, saving the file name
        // we can't actually wait on the full upload to finish, so there is no way we
        // can take information about the upload and pass it later on in the busboy parsing
        // because of this we're treating the file upload as fairly standalone
        busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimeType: string) => {
            const user = req.user as UserT
            DataSourceUploadFile(req.params.id, req.params.sourceID, user.id!, filename, encoding, mimeType, file as Readable)
            fileNames.push(filename)
        })

        // hold on to the field data, we consider this metadata and will create
        // a record to be ingested by deep lynx once the busboy finishes parsing
        busboy.on('field', (fieldName: string, value: any, fieldNameTruncated: boolean, encoding: string, mimetype:string) => {
            metadata[fieldName] = value
            metadataFieldCount++
        })

        busboy.on('finish', () => {
            // if there is no additional metadata we do not not create information
            // to be processed by Deep Lynx, simply store the file and make it available
            // via the normal file querying channels
            if(metadataFieldCount === 0) {
                res.sendStatus(200)
                next()
                return;
            }

            // update the passed meta information with the file name deep lynx
            // has stored it under
            for(const i in fileNames) metadata[`deep-lynx-file-${i}`] = fileNames[i]
            const user = req.user as UserT

            // create an "import" with a single object, the metadata and file information
            // the user will then handle the mapping of this via the normal type mapping channels
            ImportStorage.Instance.InitiateJSONImportAndUnpack(req.params.sourceID, user.id!, 'file upload', metadata)
            .then((result) => {
                if (result.isError && result.error) {
                    res.status(result.error.errorCode).json(result);
                    return
                }
                res.sendStatus(200)
            })
                .catch((err) => res.status(500).send(err))
                .finally(() => next())
        })

        return req.pipe(busboy)
    }
}

