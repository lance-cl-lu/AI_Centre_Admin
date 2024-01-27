import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { Table, Thead, Tbody, Tr, Th, Td, TableContainer, TableCaption } from "@chakra-ui/react"

function ListNoteBook() {
    // get the user from useLocation
    const user = useLocation().state.user;
    console.log(user);
    const [notebooks, setNotebooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    var [testData, setTestData] = useState(null);

    testData = [
        {statusNotebook: "running", nameNotebook: "test1", ageNotebook: "1 day", lastActivity: "1 day ago", imageNotebook: "test1", gpuNotebook: "1", cpuNotebook: "1", memoryNotebook: "1", diskNotebook: "1"},
        {statusNotebook: "stopped", nameNotebook: "test2", ageNotebook: "2 day", lastActivity: "2 day ago", imageNotebook: "test2", gpuNotebook: "2", cpuNotebook: "2", memoryNotebook: "2", diskNotebook: "2"},
        {statusNotebook: "running", nameNotebook: "test3", ageNotebook: "3 day", lastActivity: "3 day ago", imageNotebook: "test3", gpuNotebook: "3", cpuNotebook: "3", memoryNotebook: "3", diskNotebook: "3"},
    ]
    // get the notebooks of the user
    // useEffect(() => {
    //     fetch(`http://localhost:5000/api/notebooks/${user._id}`)
    //         .then((res) => res.json())
    //         .then((data) => {
    //             setNotebooks(data);
    //             setLoading(false);
    //         })
    //         .catch((err) => {
    //             setError(err.message);
    //             setLoading(false);
    //         });
    // }, [user._id]);
    // show the notebooks of the user

    return (
        <TableContainer className="AddContent">
            <Table variant='striped' colorScheme='orange'>
                <TableCaption>Imperial to metric conversion factors</TableCaption>
                <Thead>
                    <Tr>
                        <Th>Status</Th>
                        <Th>Name</Th>
                        <Th>Age</Th>
                        <Th>Last Activity</Th>
                        <Th>Image</Th>
                        <Th>GPU</Th>
                        <Th>CPU</Th>
                        <Th>Memory</Th>
                        <Th>Disk</Th>
                    </Tr>
                </Thead>
                <Tbody>

                {/* { notebooks ? (
                    notebooks.map((notebook) => (
                        <Tr>
                            <Td>{notebooks.statusNotebook}</Td>
                            <Td>{notebooks.nameNotebook}</Td>
                            <Td>{notebooks.ageNotebook}</Td>
                            <Td>{notebooks.lastActivity}</Td>
                            <Td>{notebooks.imageNotebook}</Td>
                            <Td>{notebooks.gpuNotebook}</Td>
                            <Td>{notebooks.cpuNotebook}</Td>
                            <Td>{notebooks.memoryNotebook}</Td>
                            <Td>{notebooks.diskNotebook}</Td>
                        </Tr>
                    ))
                ) : ( */
                    testData && testData.map((testData) => (
                    <Tr>
                        <Td>{testData.statusNotebook}</Td>
                        <Td>{testData.nameNotebook}</Td>
                        <Td>{testData.ageNotebook}</Td>
                        <Td>{testData.lastActivity}</Td>
                        <Td>{testData.imageNotebook}</Td>
                        <Td>{testData.gpuNotebook}</Td>
                        <Td>{testData.cpuNotebook}</Td>
                        <Td>{testData.memoryNotebook}</Td>
                        <Td>{testData.diskNotebook}</Td>
                    </Tr>
                ))
                
                }
                </Tbody>
            </Table>
        </TableContainer>
    );

}
export default ListNoteBook;