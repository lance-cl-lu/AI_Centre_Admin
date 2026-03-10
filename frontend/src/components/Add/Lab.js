import { Button, Form, Alert } from "react-bootstrap";
import { useState } from "react";

function AddLab() {
    const [expiryDate, setExpiryDate] = useState('');
    const [remainingDays, setRemainingDays] = useState(null);

    // 計算剩餘天數
    const calculateRemainingDays = (dateString) => {
        if (!dateString) return null;
        const today = new Date();
        const expiry = new Date(dateString);
        const timeDiff = expiry - today;
        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        return daysDiff;
    };

    // 處理日期變化
    const handleDateChange = (e) => {
        const selectedDate = e.target.value;
        setExpiryDate(selectedDate);
        setRemainingDays(calculateRemainingDays(selectedDate));
    };

    let addLab = async(e) => {
        e.preventDefault();
        let response = await fetch('/api/ldap/lab/add/', {    
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "lab": e.target[0].value, 
                "cpu_quota": e  .target[1].value, 
                "mem_quota": e.target[2].value, 
                "gpu_quota": e.target[3].value, 
                "gpu_vendor": e.target[4].value,
                "expiry_date": expiryDate
            }),
        });
        let data = await response.json();
        if(response.status===200){
            console.log(data);
            alert('Lab added successfully');
            window.history.back();
        } else {
            alert(response.data);
        }
    }

    return (
        <div style={{fontFamily: "Comic Sans MS"}}>
            <h1>Add Group</h1><br/>
            <Form onSubmit={addLab}>
                <div className="row">
                    <Form.Group controlId="formBasicEmail">
                        <Form.Label>Group Name</Form.Label>
                        <Form.Control type="text" placeholder="Enter Group Name" />
                    </Form.Group>
                </div>
                <br/>
                <div style={{fontFamily: "Comic Sans MS"}} className="row">
                <Form.Group controlId="formBasicEmail" className="col">
                    <Form.Label>CPU Quota</Form.Label>
                    <Form.Control type="text" placeholder="Enter CPU Quota" id="cpu_quota" defaultValue={8} />
                </Form.Group>
                <Form.Group controlId="formBasicEmail" className="col">
                    <Form.Label>Memory Quota (Gi)</Form.Label>
                    <Form.Control type="text" placeholder="Enter Memory Quota" id="mem_quota" defaultValue={16} />
                </Form.Group>
                <Form.Group controlId="formBasicEmail" className="col">
                    <Form.Label>GPU Quota</Form.Label>
                    <Form.Control as="select" id="gpu_quota" defaultValue={1}>
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                        <option value={6}>6</option>
                        <option value={7}>7</option>
                        <option value={8}>8</option>
                    </Form.Control>
                </Form.Group>
                <Form.Group controlId="formBasicEmail" className="col">
                    <Form.Label>GPU Vendor</Form.Label>
                    <Form.Control as="select" id="gpu_vendor" defaultValue={"nvidia"}>
                        <option value="NVIDIA">nvidia</option>
                        <option value="AMD">amd</option>
                    </Form.Control>
                </Form.Group>
                </div>
                <br/>
                <Form.Group className="mb-3" controlId="formExpiryDate">
                    <Form.Label>群組到期日期</Form.Label>
                    <Form.Control 
                        type="date" 
                        id="expiry_date" 
                        value={expiryDate}
                        onChange={handleDateChange}
                        min={new Date().toISOString().split('T')[0]}
                    />
                    <Form.Text className="text-muted">
                        設定此群組的到期日期，到期後用戶將進入30天待刪除期（選填）
                    </Form.Text>
                </Form.Group>
                {remainingDays !== null && (
                    <Alert variant={remainingDays <= 7 ? (remainingDays <= 3 ? 'danger' : 'warning') : 'info'}>
                        <strong>剩餘天數: {remainingDays} 天</strong>
                        {remainingDays <= 0 && ' (已到期)'}
                        {remainingDays > 0 && remainingDays <= 3 && ' (即將到期)'}
                        {remainingDays > 3 && remainingDays <= 7 && ' (接近到期)'}
                    </Alert>
                )}
                <Button variant="primary" type="submit">Submit</Button>
                <Button variant="warning" onClick={() => window.history.back()} style={{ margin: '1rem' }}>Cancel and Back</Button>
            </Form>
        </div>
    )
}

export default AddLab;
