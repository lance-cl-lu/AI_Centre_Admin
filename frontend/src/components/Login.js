import React, { useContext } from "react";
import AuthContext from "../context/AuthContext";
import { Icon } from '@chakra-ui/react'
import { GrView } from "react-icons/gr";
import ContactEmergencyIcon from '@mui/icons-material/ContactEmergency';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { Input, Button, InputRightElement, InputGroup, FormControl, FormLabel, Box } from '@chakra-ui/react';
import './Login.css'
function Login() {
    let {loginUser} = useContext(AuthContext)    
    const [show, setShow] = React.useState(false)
    const handleClick = () => setShow(!show)

    return (
        <Box className="Login" p={8} borderRadius="12px" w="100%" maxW="500px" mx="auto" mt="10%" mb="10%">
                <form onSubmit={loginUser} className="LoginForm">
                <img src="https://aic.cgu.edu.tw/var/file/44/1044/msys_1044_4886051_59674.png" alt="CUG AI Centre" className="login-img"/><br/>
                <h2>Login</h2><br/>
                <FormControl className="mb-3">
                    <InputGroup>
                    <FormLabel htmlFor='usernameForm'>Username <ContactEmergencyIcon/></FormLabel>
                    <Input variant='outline' placeholder="Enter username" id="usernameForm" name="username" className="LoginForm-input form-control" />
                    </InputGroup>
                </FormControl>
                <FormControl className="mb-3">
                    <InputGroup>
                    <FormLabel htmlFor="passwordForm">Password  <VpnKeyIcon/></FormLabel>
                    <Input variant='outline' type={show ? 'text' : 'password'} placeholder="Enter password" id="passwordForm" name="password" className="LoginForm-input form-control" />
                    <InputRightElement width='4.5rem'>
                        <Button h='1.75rem' size='sm' onClick={handleClick}>
                        {show ? 'Hide' : <Icon as={GrView} />}
                        </Button>
                    </InputRightElement>
                    </InputGroup>
                </FormControl>
                <br/>
                <Button type="submit" className="btn btn-primary-danger login-btn">Submit</Button>
                </form>
        </Box>
    )
}
export default Login
