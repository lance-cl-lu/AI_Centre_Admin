// This is the page for "Move" (move notebooks). [Patten, 2025/01/05]
import React, { useState, useEffect, useContext } from "react";
import { Card, Button, ListGroup, Form, FloatingLabel } from "react-bootstrap";
import { createFilterOptions } from "@mui/material";
import { useLocation } from "react-router-dom";
import jwt_decode from "jwt-decode";
import AuthContext from "../context/AuthContext"
import YAML from "js-yaml"
import JSZip from "jszip";
import {saveAs} from "file-saver";
import Swal from "sweetalert2"

function FileManagement() {
    // get the user from useLocation
    let { logoutUser, user } = useContext(AuthContext);
    const [uploadList, setUploadList] = useState([]);
    let [uploadFiles, setUploadFiles] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [notebookList, setOptions] = useState();
    const [selectedValue, setSelectedValue] = useState();
    // let download_button = document.getElementById("download_button");
    // download_button.addEventListener("click", getNotebookYAML(selectedValue));
    let notebookYAML = {};

    useEffect(() => {
        fetch("/api/notebook/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({"user": user.username})
        })
        .then(res => res.json())
        .then(data => setOptions(data));
    },
    [user]);

    const getNotebookYAML = async (notebookName) => {
        if (notebookName !== undefined & notebookName !== ""){
            const zip = new JSZip();
            let json = await fetch("/api/getNotebookYAML/", { //get the yamls
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    "namespace": user.username,
                    "notebook_name": notebookName,
                }),
            })
            .then(res => res.json())
            .then(data => {return data});
            console.log(json);

            // prepare notebook.yaml for downloading
            let notebookJSON = await json["notebook"];
            notebookYAML = YAML.dump(notebookJSON);
            zip.file(notebookName + ".yaml", notebookYAML);

            // prepare pv.yaml (may be more than one) for downloading
            let pvJSONs = await json["pv"];
            for(let i = 0; i < pvJSONs.length; i++){
                let pvJSON = pvJSONs[i];
                let pvYAML = YAML.dump(pvJSON);
                zip.file(notebookName + "_pv_" + (i + 1) + ".yaml", pvYAML);
            }

            // prepare pvc.yaml (may be more than one) for downloading
            let pvcJSONs = await json["pvc"];
            for(let i = 0; i < pvcJSONs.length; i++){
                let pvcJSON = pvcJSONs[i];
                let pvcYAML = YAML.dump(pvcJSON);
                zip.file(notebookName + "_pvc_" + (i + 1) + ".yaml", pvcYAML);
            }
            zip.generateAsync({type: "blob"}).then((content) => {
                saveAs(content, notebookName + ".zip")
            });
        }
    };
    
    const handleSelectChange = (event) => {
        setSelectedValue(event.target.value);
    };

    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
        const uploadedFileNames = files.map(file => file.name);
        setUploadList([...uploadList, ...uploadedFileNames]);
        setUploadFiles([...uploadFiles, ...files]);
        // const control = document.getElementById("upload_control");
        // control.value = ""
        event.target.value = ""
    };
    const handleDeleteFile = (index) => {
        const updatedList = uploadList.filter((_, i) => i !== index);
        const updatedFiles = uploadFiles.filter((_, i) => i !== index);
        setUploadList(updatedList);
        setUploadFiles(updatedFiles);
    };

    const sendFile = async (uploadFils) => {
        console.log(uploadFiles);
        if (!uploadFiles) return;

        const formData = new FormData();
        formData.append("file", uploadFiles[0]);
        try {
            const data = await fetch("/api/uploadNotebookYAML/", {
                method: "POST",
                body: formData,
            })
            .then(res => {
                return res.json()
            });
            
            const result = data["results"];
            Swal.fire({
                title: "Upload Successfully",
                text: "Note: Existed resources wiil NOT be replaced!",
                icon: "success"
            });
        } catch {
            Swal.fire({
                title: "Upload Failed",
                icon: "error"
            });
        }
        
    };

    return (
        <div style={{ padding: "20px" }}>
            <h3>Notebooks搬移</h3>

            {/* 下載區域 */}
            <Card className="mb-4">
                <Card.Header>下載Notebooks</Card.Header>
                <Card.Body>
                    {/* <ListGroup>
                        {downloadList.map((file, index) => (
                            <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                                {file}
                                <Button variant="primary" size="sm" onClick={() => downloadFile(file)}>
                                    下載
                                </Button>
                            </ListGroup.Item>
                        ))}
                    </ListGroup> */}
                    <FloatingLabel
                        controlId="floatingInput"
                        label="Select A Notebook"
                        className="mb-3"
                    >
                        <Form.Select aria-label="Floating label select example" id="gpuQuota" onChange={handleSelectChange} value={selectedValue}>
                            <option value="">Select A Notebook</option>
                            {typeof notebookList != "undefined" ? (
                                notebookList.map((notebook, index) => (
                                <option key={index} value={notebook.name}>{notebook.name}</option>
                                ))
                            ) : (
                            <option disabled>loading notebookList</option>
                            )}
                        </Form.Select>
                    </FloatingLabel>
                    <Button id="download_button" onClick={() => getNotebookYAML(selectedValue)}>下載</Button>
                </Card.Body>
            </Card>

            {/* 上傳區域 */}
            <Card>
                <Card.Header>上傳Notebooks</Card.Header>
                <Card.Body>
                    <Form.Group controlId="fileUpload">
                        <Form.Label>選擇檔案上傳</Form.Label>
                        <Form.Control id="upload_control" type="file" onChange={handleFileUpload} value=""/>
                    </Form.Group>

                    <h5 className="mt-4">待上傳的檔案：</h5>
                    <ListGroup>
                        {uploadList.map((file, index) => (
                            <ListGroup.Item key={index}>
                                {file}
                                <Button onClick={() => handleDeleteFile(index)}>刪除</Button>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                    <Button id="upload_button" onClick={() => sendFile(uploadFiles)}>上傳</Button>
                </Card.Body>
            </Card>
        </div>
    );
}

export default FileManagement;