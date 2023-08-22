import { useLocation } from 'react-router-dom'
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import { Row } from 'react-bootstrap';

function Password() {
    let state = useLocation().state;
    console.log(state)
    const handleSubmit = async () => {
        let password = document.getElementById("inputPassword")
        let comfirm = document.getElementById("inputComfirmPassword")
        if (password.value && comfirm.value ) {
            if(password.value !== comfirm.value) {
                alert("Password do not match!!")
                password.value = ""
                comfirm.value = ""
            } else {
                let response = await fetch("http://localhost:8000/api/password/change/", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        "username": state.user,
                        "password": password.value
                    }),
                })
                if(response.status===200) {
                    alert('Password change successfully');
                } else {
                    alert("Something wrong!!")
                }
            }
        } else {
            alert("Please enter the password.")
            password.value = ""
            comfirm.value = ""
        }
    }
    return (
        <div>
            <h1>Please enter your new passworp for {state.user}</h1>
            <Form className='form-css'>
                <Form.Group as={Row} className="mb-3" controlId="formnewpassword">
                    <Form.Label column sm="2">
                        New Password
                    </Form.Label>
                    <Col sm="10">
                        <Form.Control plaintext id="inputPassword" />
                    </Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formnewcomfirmpassword">
                    <Form.Label column sm="2">
                        ComfirmPassword
                    </Form.Label>
                    <Col sm="10">
                        <Form.Control plaintext id="inputComfirmPassword" />
                    </Col>
                </Form.Group>
                <Button variant="primary" type="button" onClick={handleSubmit}>
                    Submit
                </Button>
            </Form>
        </div>
    )
}

export default Password