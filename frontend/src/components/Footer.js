import { Card, CardHeader, CardBody, Text } from "@chakra-ui/react";
function Footer() {
    return (
        <Card colorScheme="orange" className="text-center" style={{ border: "1px solid orange" }}>
            <CardHeader size="sm" style={{ borderBottom: "1px solid orange" }} fontSize="24" fontFamily="helvetica">CGU AI Center Ldap Management System</CardHeader>
            <CardBody size="sm">
                <Text>Address：The Management Building, 11F, Chang Gung University, Taiwan</Text>
                <Text>Tel：+886-3-2118800 ext. 3001</Text>
                <Text>E-Mail：sueliu@cgu.edu.tw</Text>
                <Text>Copyright © 2022-2024 Designed by AI Center, Chang Gung University</Text>
            </CardBody>
        </Card>
    );
    }
export default Footer;