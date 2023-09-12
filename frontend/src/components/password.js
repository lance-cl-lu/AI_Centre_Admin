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
                let response = await fetch("http://120.126.23.245:31190/api/password/change/", {
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
                    alert("Password is Invalid!!")
                }
            }
        } else {
            alert("Please enter the password.")
            password.value = ""
            comfirm.value = ""
        }
    }
    return (
        <div style={{fontFamily: "Segoe UI"}}>
            <h1>Please enter  new password for {state.user}</h1><br/>
            <Form className='form-css' style={{boxShadow: "0px 0px 10px 0px #888888", padding: "20px", borderRadius: "12px"}}>
                <Form.Group as={Row} className="mb-3" controlId="formnewpassword" style={{flexWrap: 'nowrap', paddingTop: '20px'}}>
                    <Form.Label column sm="2">
                        New Password
                    </Form.Label>
                    <Col sm="10">
                        <Form.Control plaintext id="inputPassword" style={{border: '1px solid #ced4da', borderRadius: '12px', width: '40%', height: '38px'}} />
                    </Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formnewcomfirmpassword" style={{flexWrap: 'nowrap', paddingTop: '20px'}}>
                    <Form.Label column sm="2">
                        ComfirmPassword
                    </Form.Label>
                    <Col sm="10">
                        <Form.Control plaintext id="inputComfirmPassword" style={{border: '1px solid #ced4da', borderRadius: '12px', width: '40%', height: '38px'}} />
                    </Col>
                </Form.Group>
                <Button variant="primary" type="button" onClick={handleSubmit} style={{margin: "1rem"}}>
                    Submit
                </Button>
            </Form>
        </div>
    )
}

export default Password