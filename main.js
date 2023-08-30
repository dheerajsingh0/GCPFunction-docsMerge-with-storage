const { Storage } = require("@google-cloud/storage");
const Canvas = require('canvas');
var async = require("async");
const request = require('request');
const PDFMerger = require('pdf-merger-js');
var xlsx = require("xlsx");
const pdf = require('html-pdf');
const bucketdata = require('./config/GC_Config.js');
const { PDFDocument } = require('pdf-lib');
var uuid = require('uuid');

const storage = new Storage({
    keyFilename: "./config/GC_Credentials.json",
    projectId: bucketdata.projectId
});
imgfiledata = [];
const bucket = storage.bucket(bucketdata.Bucket);
const snowArchived = bucketdata.snowArchived;
const outputFolder = bucketdata.outputFolder;

mergeSnowAttachments().then(() => console.log("Completed")).catch(err => console.log(err));

async function mergeSnowAttachments() {
    return new Promise(async function (resolve, reject) {
        try {
            const [files] = await bucket.getFiles({ prefix: bucketdata.inputFolder }); //get the all files
            const folders = [];

            await request.get(
                {
                    url: 'url',  //get the file name from the database to read the new file from google cloud
                    json: true,
                }, async function (error, response, body) {
                    if (response.statusCode != 200) {
                        console.log("Cannot get case number")
                    } else {
                        response.body.map((data) => {  // add all file name to folder array
                            folders.push(data.CASE_NUMBER)
                        })

                        var newSnow = response.body;

                        var totalFolders = newSnow.length;
                        var folderCount = 0;
                        async.eachSeries(newSnow, async function (snow, callback) {
                            var snowDetailId = 0;
                            var newFileName = snow.CASE_NUMBER + "-" + Date.now() + ".pdf";
                            const mergedPdf = await PDFDocument.create();

                            var updateBody = [{
                                id: snow.id,
                                STATUS: "PROCESSED",
                                LAST_MODIFIED_ON: new Date().toGMTString(),
                                LAST_MODIFIED_BY: "owner"
                            }];

                            var body = {
                                CASE_NUMBER: snow.CASE_NUMBER,
                                TITLE: snow.CASE_NUMBER,
                                STATUS: "NEW",
                                REQUESTED_BY: null,
                                REQUESTED_ON: null,
                                CREATED_BY: "owner"
                            };
                            // update in db
                            await request.post(
                                {
                                    url: "url", //post into the database
                                    json: true,
                                    body: body
                                }, function (error, response, body) {
                                    if (response.statusCode != 200) {
                                        console.log("Case Number not exist")
                                    } else {
                                        snowDetailId = response.body.id;

                                    }
                                })

                            var filenames = files.filter(data => (data.name.split("/")[1] == snow.CASE_NUMBER))
                            // filter the all file which matched following function 
                            var actualFile = filenames.filter(file => (file.name.endsWith(".pdf") || file.name.endsWith(".png") || file.name.endsWith(".jpg") || file.name.endsWith(".jpeg") || file.name.endsWith(".xls") || file.name.endsWith(".xlsx")))
                            console.log(actualFile.length, "totalfile count")
                            var totalFileCount = actualFile.length;
                            var count = 0;
                            var fileObj = []
                            //after filter map the file one by one and perform the operation
                            async.eachSeries(filenames, async function (file, callback1) {

                                if (file.name.endsWith(".pdf")) {
                                    var actualFileName = file.name.split("/")[2];
                                    try {
                                        await bucket.file(file.name).download(async function (err, pdfdata) {
                                            if (err) {
                                                console.log(err);
                                                count = count + 1;
                                                reject(err);
                                            }
                                            else {
                                                count = count + 1;
                                                const destPdf = await PDFDocument.load(pdfdata);
                                                const copiedPages = await mergedPdf.copyPages(destPdf, destPdf.getPageIndices());
                                                copiedPages.forEach((page) => {
                                                    mergedPdf.addPage(page);
                                                });


                                                await bucket.file(file.name).move(snowArchived + snow.CASE_NUMBER + '/' + actualFileName, function (err, destinationFile, apiResponse) {
                                                    if (err) {
                                                        console.log('Error occured while Moving the file ' + file.name, err);
                                                    }
                                                    else {
                                                        console.log('Processed file and Moved file ' + file.name);
                                                    }
                                                });


                                                console.log(totalFileCount + "totalFileCount" + " ", count + "count")
                                                if (totalFileCount == count) {
                                                    folderCount = folderCount + 1;
                                                    var fileData = await mergedPdf.saveAsBase64();
                                                    var buff = await new Buffer.from(fileData, 'base64');
                                                    await bucket.file(outputFolder + newFileName).save(buff, async function (err) {
                                                        if (err) {
                                                            console.log(err);
                                                        }
                                                        else {
                                                            console.log("done");
                                                            var fileBody = {
                                                                SERVICE_NOW_FILE_DETAILS_UUID: uuid.v1(),
                                                                SERVICE_NOW_DETAILS_ID: snowDetailId,
                                                                FILE_NAME: newFileName,
                                                                FILE_EXTENSION: "pdf",
                                                                CREATED_BY: "owner"
                                                            };

                                                            console.log(fileBody);

                                                            await request.post(
                                                                {
                                                                    url: "url",  //replace the url if you want to post in database
                                                                    json: true,
                                                                    body: fileBody
                                                                }, function (error, response, body) {
                                                                    if (response.statusCode != 200) {
                                                                        console.log("Failed Insert into file details")
                                                                    } else {
                                                                        //snowDetailId = response.body.SERVICE_NOW_DETAILS_ID;
                                                                        console.log("Inserted into file details")
                                                                        // callback();

                                                                    }
                                                                })
                                                            var updateSnowDetail = [{
                                                                SERVICE_NOW_DETAILS_ID: snowDetailId,
                                                                STATUS: "PROCESSED",
                                                                LAST_MODIFIED_BY: "owner"
                                                            }];
                                                            await request.put(
                                                                {
                                                                    url: "url",  //replace url 
                                                                    json: true,
                                                                    body: updateSnowDetail
                                                                }, function (error, response, body) {
                                                                    if (response.statusCode != 200) {
                                                                        console.log("Case Number exist")

                                                                    } else {
                                                                        console.log("Case Number saved")


                                                                    }
                                                                })

                                                            await request.put(
                                                                {
                                                                    url: "url",  //replace url 

                                                                    json: true,
                                                                    body: updateBody
                                                                }, function (error, response, body) {
                                                                    //console.log(error)
                                                                    console.log(response.statusCode)
                                                                    if (response.statusCode != 200) {
                                                                        console.log(response.statusCode)
                                                                    } else {
                                                                        console.log("updated exception")
                                                                    }
                                                                });
                                                            // callback();
                                                            //loopCount = loopCount + 1;
                                                            //resolve();                                 
                                                            // callback();
                                                        }
                                                    });
                                                }
                                                // callback1();
                                            }

                                        })
                                    }
                                    catch (error) {
                                        console.log("Error while downloading file", error);
                                    }


                                }
                                else if (file.name.endsWith(".png") || file.name.endsWith(".jpg") || file.name.endsWith(".jpeg")) {
                                    var actualFileName = file.name.split("/")[2];
                                    let casenumber = file.name.split("/")[1]


                                    await bucket.file(file.name).download(async function (err, imgcontent) {
                                        if (err) {
                                            console.log(err);
                                        }
                                        const img = new Canvas.Image();
                                        img.src = imgcontent;
                                        const canvas = Canvas.createCanvas(1200, 720, 'pdf');
                                        const context = canvas.getContext('2d');
                                        context.drawImage(img, 0, 0, 1200, 720);
                                        let data = canvas.toBuffer();
                                        count = count + 1;
                                        const destPdf = await PDFDocument.load(data);
                                        const copiedPages = await mergedPdf.copyPages(destPdf, destPdf.getPageIndices());
                                        copiedPages.forEach((page) => {
                                            mergedPdf.addPage(page);
                                        });

                                        await bucket.file(file.name).move(snowArchived + snow.CASE_NUMBER + '/' + actualFileName, function (err, destinationFile, apiResponse) {
                                            if (err) {
                                                console.log('Error occured while Moving the file ' + file.name, err);
                                            }
                                            else {
                                                console.log('Processed file and Moved file ' + file.name);

                                            }
                                        });
                                        console.log(totalFileCount + "totalFileCount" + " ", count + "count")
                                        if (totalFileCount == count) {
                                            console.log(fileObj)
                                            folderCount = folderCount + 1;
                                            var fileData = await mergedPdf.saveAsBase64();
                                            var buff = await new Buffer.from(fileData, 'base64');
                                            await bucket.file(outputFolder + newFileName).save(buff, async function (err) {
                                                if (err) {
                                                    console.log(err);
                                                }
                                                else {
                                                    console.log("done");
                                                    console.log(outputFolder + newFileName)
                                                    var fileBody = {
                                                        SERVICE_NOW_FILE_DETAILS_UUID: uuid.v1(),
                                                        SERVICE_NOW_DETAILS_ID: snowDetailId,
                                                        FILE_NAME: newFileName,
                                                        FILE_EXTENSION: "pdf",
                                                        CREATED_BY: "owner"
                                                    };

                                                    console.log(fileBody);
                                                    console.log("Line 354")
                                                    console.log(snowDetailId)

                                                    await request.post(
                                                        {
                                                            url: "ur",  //replace url 
                                                            json: true,
                                                            body: fileBody
                                                        }, function (error, response, body) {
                                                            if (response.statusCode != 200) {
                                                                console.log("Failed Insert into file details")
                                                            } else {
                                                                console.log("Inserted into file details")

                                                            }
                                                        })
                                                    var updateSnowDetail = [{
                                                        SERVICE_NOW_DETAILS_ID: snowDetailId,
                                                        STATUS: "PROCESSED",
                                                        LAST_MODIFIED_BY: "owner"
                                                    }];
                                                    await request.put(
                                                        {
                                                            url: "url",  //replace url 
                                                            json: true,
                                                            body: updateSnowDetail
                                                        }, function (error, response, body) {
                                                            if (response.statusCode != 200) {
                                                                console.log("Case Number exist")

                                                            } else {
                                                                console.log("Case Number saved")


                                                            }
                                                        })

                                                    await request.put(
                                                        {
                                                            url: "url",  //replace url 
                                                            json: true,
                                                            body: updateBody
                                                        }, function (error, response, body) {
                                                            console.log(error)
                                                            console.log(response.statusCode)
                                                            if (response.statusCode != 200) {
                                                                console.log(response.statusCode)
                                                            } else {
                                                                console.log("updated exception")
                                                            }
                                                        });
                                                }
                                            });
                                        }
                                    })
                                }
                                else if ((file.name.endsWith(".xls") || file.name.endsWith(".xlsx"))) {
                                    var actualFileName = file.name.split("/")[2];
                                    let casenumber = file.name.split("/")[1]


                                    bucket.file(file.name).download(function (err, contents) {
                                        if (err) {
                                            console.log(err);
                                            reject(err);
                                        }
                                        var wb = xlsx.read(contents)
                                        for (var i = 1; i <= wb.SheetNames.length; i++) {
                                            var sheetName = wb.SheetNames[i - 1]
                                            var sheetValue = wb.Sheets[sheetName]
                                            var htmlData = xlsx.utils.sheet_to_html(sheetValue);
                                            const html = htmlData
                                            const options = {
                                                format: 'A3',
                                                orientation: "landscape"
                                            }
                                            pdf.create(html, options).toBuffer(async function (err, buffer) {
                                                if (err) return console.log(err);
                                                count = count + 1;
                                                const destPdf = await PDFDocument.load(buffer);
                                                const copiedPages = await mergedPdf.copyPages(destPdf, destPdf.getPageIndices());
                                                copiedPages.forEach((page) => {
                                                    mergedPdf.addPage(page);
                                                });


                                                await bucket.file(file.name).move(snowArchived + snow.CASE_NUMBER + '/' + actualFileName, function (err, destinationFile, apiResponse) {
                                                    if (err) {
                                                        console.log('Error occured while Moving the file ' + file.name, err);
                                                    }
                                                    else {

                                                        console.log('Processed file and Moved file ' + file.name);
                                                    }
                                                });
                                                console.log(totalFileCount + "totalFileCount" + " ", count + "count")
                                                if (totalFileCount == count) {
                                                    console.log(fileObj)
                                                    folderCount = folderCount + 1;
                                                    var fileData = await mergedPdf.saveAsBase64();
                                                    var buff = await new Buffer.from(fileData, 'base64');
                                                    await bucket.file(outputFolder + newFileName).save(buff, async function (err) {
                                                        if (err) {
                                                            console.log(err);
                                                        }
                                                        else {
                                                            console.log("done");
                                                            console.log(outputFolder + newFileName)
                                                            var fileBody = {
                                                                SERVICE_NOW_FILE_DETAILS_UUID: uuid.v1(),
                                                                SERVICE_NOW_DETAILS_ID: snowDetailId,
                                                                FILE_NAME: newFileName,
                                                                FILE_EXTENSION: "pdf",
                                                                CREATED_BY: "owner"
                                                            };

                                                            console.log(fileBody);

                                                            await request.post(
                                                                {
                                                                    url: "url",  //replace url 
                                                                    json: true,
                                                                    body: fileBody
                                                                }, function (error, response, body) {
                                                                    if (response.statusCode != 200) {
                                                                        console.log("Failed Insert into file details")
                                                                    } else {
                                                                        console.log("Inserted into file details")

                                                                    }
                                                                })
                                                            var updateSnowDetail = [{
                                                                SERVICE_NOW_DETAILS_ID: snowDetailId,
                                                                STATUS: "PROCESSED",
                                                                LAST_MODIFIED_BY: "owner"
                                                            }];
                                                            await request.put(
                                                                {
                                                                    url: "url",  //replace url 

                                                                    json: true,
                                                                    body: updateSnowDetail
                                                                }, function (error, response, body) {
                                                                    if (response.statusCode != 200) {
                                                                        console.log("Case Number exist")
                                                                    } else {
                                                                        console.log("Case Number saved")
                                                                    }
                                                                })

                                                            await request.put(
                                                                {
                                                                    url: "url",  //replace url 

                                                                    json: true,
                                                                    body: updateBody
                                                                }, function (error, response, body) {
                                                                    console.log(error)
                                                                    console.log(response.statusCode)
                                                                    if (response.statusCode != 200) {
                                                                        console.log(response.statusCode)
                                                                    } else {
                                                                        console.log("updated exception")
                                                                    }
                                                                });

                                                        }
                                                    });
                                                }
                                            });

                                        }
                                    })
                                }

                                if (totalFileCount == count) {
                                    setTimeout(console.log(fileObj), 5000)
                                    folderCount = folderCount + 1;
                                    var fileData = await mergedPdf.saveAsBase64();
                                    var buff = await new Buffer.from(fileData, 'base64');
                                    await bucket.file(outputFolder + newFileName).save(buff, async function (err) {
                                        if (err) {
                                            console.log(err);
                                        }
                                        else {
                                            console.log("done");
                                            console.log(outputFolder + newFileName);
                                        }
                                    });
                                }
                            });
                            // }
                            if (totalFolders == folderCount) {
                                // alll file process
                            }
                        });
                        console.log("Outside async");

                    }
                })
        }
        catch (error) {
            console.log(error)
            reject(error)
            //resolve();
        }
    });
}