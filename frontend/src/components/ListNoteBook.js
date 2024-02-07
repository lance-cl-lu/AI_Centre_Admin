import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Table, Thead, Tbody, Tr, Th, Td, TableContainer, TableCaption, Spinner } from "@chakra-ui/react"

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


    return (
        <TableContainer className="AddContent">
            <Table variant='striped' colorScheme='orange'>
                <TableCaption>Available Notebooks</TableCaption>
                <Thead>
                    <Tr>
                        <Th>Name</Th>
                        <Th>CPU</Th>
                        <Th>Memory</Th>
                        <Th>Removal</Th>
                    </Tr>
                </Thead>
                <Tbody>

                {notebooks ? (
                    notebooks.map((notebook) => (
                        <Tr>
                            <Td>{notebook.name}</Td>
                            <Td>{notebook.cpu}</Td>
                            <Td>{notebook.memory}</Td>
                            <Td>{notebook.removal}</Td>
                        </Tr>
                    ))
                ) : <span><Spinner></Spinner>loading...</span>}
                </Tbody>
            </Table>
        </TableContainer>
    );

}
export default ListNoteBook;
