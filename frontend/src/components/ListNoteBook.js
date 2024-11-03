import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Table, Thead, Tbody, Tr, Th, Td, TableContainer, TableCaption, Spinner, Checkbox } from "@chakra-ui/react"
import "./ListNoteBook.css";

function ListNoteBook() {
    // get the user from useLocation
    const user = useLocation().state.user;
    console.log(user);
    const [notebooks, setNotebooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    var [testData, setTestData] = useState(null);

    useEffect(() => {
        fetch('/api/notebook/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({user: user})
        })
        .then(response => response.json())
        .then(data => {
            setNotebooks(data);
            console.log(data);
            setLoading(false);
        })
        .catch((error) => {
            setError(error);
            setLoading(false);
        });
    }
    , [user]);

    let handleOnChange = (name) => (event) => {
        console.log(event.target.checked);
        console.log(name);
        let persisitent = event.target.checked ? "true" : "false";
        fetch('/api/setNotebook/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({user: user, notebookName: name, persisitent: persisitent})
        })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            setTestData(data);
        })
        .catch((error) => {
            setError(error);
        });
    }


    return (
        <TableContainer className="AddContent">
            <Table variant='striped' colorScheme='orange'>
                <TableCaption>Available Notebooks</TableCaption>
                <Thead>
                    <Tr>
                        <Th>Name</Th>
                        <Th>CPU</Th>
                        <Th>Memory</Th>
                        <Th>GPU</Th>
                        <Th>persisitent</Th>
                        <Th>Status</Th>
                    </Tr>
                </Thead>
                <Tbody>

                {notebooks ? (
                    notebooks.map((notebook) => (
                        <Tr>
                            <Td>{notebook.name}</Td>
                            <Td>{notebook.cpu}</Td>
                            <Td>{notebook.memory}</Td>
                            <Td>{notebook.gpus}</Td>
                            <Td><Checkbox onChange={handleOnChange(notebook.name)} value={notebook.name} defaultChecked={notebook.persisitent === "true" ? true : false}></Checkbox></Td>
                            <Td>{notebook.status}</Td>
                        </Tr>
                    ))
                ) : <span><Spinner></Spinner>loading...</span>}
                </Tbody>
            </Table>
        </TableContainer>
    );

}
export default ListNoteBook;
