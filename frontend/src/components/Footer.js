import { Card } from "react-bootstrap";

function Footer() {
    return (
        <Card border="warning" className="text-center">
            <Card.Header>CGU AI Center Ldap Management System</Card.Header>
            <Card.Body>
                <p>Address：The Management Building, 11F, Chang Gung University, Taiwan</p>
                <p>Tel：+886-3-2118800 ext. 3001</p>
                <p>E-Mail：sueliu@cgu.edu.tw</p>
                <p>Copyright © 2010-2020 Designed by AI center, Chang Gung University</p>
            </Card.Body>
        </Card>
    );
    }
export default Footer;