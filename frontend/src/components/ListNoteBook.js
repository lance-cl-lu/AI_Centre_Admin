import { Card } from "react-bootstrap";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";

function ListNoteBook() {
    // get the user from useLocation
    const user = useLocation().state.user;
    const [notebooks, setNotebooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // get the notebooks of the user
    useEffect(() => {
        fetch(`http://localhost:5000/api/notebooks/${user._id}`)
            .then((res) => res.json())
            .then((data) => {
                setNotebooks(data);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, [user._id]);
    // show the notebooks of the user

    return (
        <div className="AddContent">
            {loading ? (
                <p>Loading...</p>
            ) : error ? (
                <p>{error}</p>
            ) : notebooks.length === 0 ? (
                <p>No notebooks found.</p>
            ) : (
                notebooks.map((notebook) => (
                    <Card className="AddType" key={notebook._id}>
                        <Card.Body>
                            <Link
                                to={{
                                    pathname: `/notebooks/${notebook._id}`,
                                    state: { notebook },
                                }}
                                className="LinkStyle"
                            >
                                <span>
                                    {notebook.name}
                                </span>
                            </Link>
                        </Card.Body>
                    </Card>
                ))
            )}
        </div>
    );

}
export default ListNoteBook;