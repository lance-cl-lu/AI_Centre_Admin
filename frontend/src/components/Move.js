// This is the page for "Move" (move notebooks). It's added by Patten in 2025/01/05
import React, { useState, useEffect, useContext } from "react";
import { Card, Button, ListGroup, Form, FloatingLabel } from "react-bootstrap";
import { createFilterOptions } from "@mui/material";
import { useLocation } from "react-router-dom";
import jwt_decode from "jwt-decode";
import AuthContext from "../context/AuthContext"

function FileManagement() {
    // get the user from useLocation
    let { logoutUser, user } = useContext(AuthContext);
    const [uploadList, setUploadList] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [notebookList, setOptions] = useState();

    useEffect(() => {
        console.log("user:", user.username);
        fetch("/api/notebook/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({user: user.username})
        })
        .then(res => res.json())
        .then(data => setOptions(data));
    },
    [user]);
    useEffect(() => {
        console.log("notebookList:", notebookList);
    }, [notebookList]);

    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
        const uploadedFileNames = files.map(file => file.name);
        setUploadList([...uploadList, ...uploadedFileNames]);
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
                        <Form.Select aria-label="Floating label select example" id="gpuQuota">
                            {typeof notebookList != "undefined" ? (
                                notebookList.map((notebook, index) => (
                                <option key={index} value={notebook.name}>{notebook.name}</option>
                                ))
                            ) : (
                            <option disabled>loading notebookList</option>
                            )}
                        </Form.Select>
                    </FloatingLabel>
                    <Button>下載</Button>
                </Card.Body>
            </Card>

            {/* 上傳區域 */}
            <Card>
                <Card.Header>上傳Notebooks</Card.Header>
                <Card.Body>
                    <Form.Group controlId="fileUpload">
                        <Form.Label>選擇文件上傳</Form.Label>
                        <Form.Control type="file" multiple onChange={handleFileUpload} />
                    </Form.Group>

                    <h5 className="mt-4">已上傳的文件：</h5>
                    <ListGroup>
                        {uploadList.map((file, index) => (
                            <ListGroup.Item key={index}>{file}</ListGroup.Item>
                        ))}
                    </ListGroup>
                </Card.Body>
            </Card>
        </div>
    );
}

export default FileManagement;