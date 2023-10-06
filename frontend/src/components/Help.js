import ReactMarkdown from "react-markdown";
import { useEffect, useState } from 'react';
import { Card } from 'react-bootstrap';

function Help() {
    const [content, setContent] = useState("");
    useEffect(() => {
        fetch("Help.md")
          .then((res) => res.text())
          .then((text) => setContent(text));
      }, []);

    return (
        <Card className="text-center">
            <Card.Header>LDAP System Help</Card.Header>
            <Card.Body>
                <ReactMarkdown children={content} />
            </Card.Body>
        </Card>
    )
}

export default Help