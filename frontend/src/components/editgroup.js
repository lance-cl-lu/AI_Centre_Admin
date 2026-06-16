import React, { useEffect, useState } from "react";
import { useLocation } from 'react-router-dom';
import ContactPageIcon from '@mui/icons-material/ContactPage';
import Swal from 'sweetalert2'
import { Button, Form, Alert } from "react-bootstrap";

function EditGroup() {
    const location = useLocation();
    const state = location.state;
    const [labinfo, setLabinfo] = useState([]);
    const [expiryDate, setExpiryDate] = useState('');
    const [originalExpiryDate, setOriginalExpiryDate] = useState('');  // 追蹤原始到期日期
    const [remainingDays, setRemainingDays] = useState(null);
    useEffect(() => {
            labinfofetch();
    }, [state]);

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
    let labinfofetch = async() => {
        let response = await fetch('/api/ldap/lab/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({'lab': state.lab}),
        });
        let data = await response.json();
        if(response.status===200){
            console.log("===== LABINFO FETCH =====");
            console.log("labinfo", data);
            console.log("expiryDate from API:", data.expiryDate);
            console.log("remainingDays from API:", data.remainingDays);
            console.log("===== END LABINFO FETCH =====");
            setLabinfo(data);
            // 設定現有的到期日期
            setExpiryDate(data.expiryDate || '');
            setOriginalExpiryDate(data.expiryDate || '');  // 儲存原始值
            if (data.remainingDays !== undefined) {
                setRemainingDays(data.remainingDays);
            }
        } else {
            console.log('error');
        }
    }

    let editLab = async() => {
        // 檢查到期日期是否有變更
        const expiryDateChanged = expiryDate !== originalExpiryDate;

        console.log('===== FRONTEND DEBUG =====');
        console.log('Original expiry date:', originalExpiryDate);
        console.log('Current expiry date:', expiryDate);
        console.log('Expiry date changed:', expiryDateChanged);
        console.log('Lab name:', state.lab);
        
        // 如果到期日期有變更，先確認
        if (expiryDateChanged) {
            const confirmResult = await Swal.fire({
                title: '確認變更到期日期',
                html: `
                    <div style="text-align: left;">
                        <p><strong>原到期日期：</strong>${originalExpiryDate || '未設定'}</p>
                        <p><strong>新到期日期：</strong>${expiryDate || '未設定'}</p>
                        ${expiryDate ? `<p><strong>剩餘天數：</strong>${remainingDays} 天</p>` : ''}
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: '確認儲存',
                cancelButtonText: '取消',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
            });
            
            console.log('Confirm result:', confirmResult);
            
            // 如果用戶取消，就不執行儲存
            if (!confirmResult.isConfirmed) {
                return;
            }
        }
        
        const requestBody = {
            'lab': state.lab,
            'cpu_quota': document.getElementById('cpu_quota').value,
            'mem_quota': document.getElementById('memory_quota').value,
            'gpu_quota': document.getElementById('gpu_quota').value,
            'gpu_vendor': document.getElementById('gpu_vendor').value,
            'expiry_date': expiryDate || null
        };

        console.log('Request body:', requestBody);

        let response = await fetch('/api/ldap/lab/edit/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        console.log('Response status:', response.status);
        const responseData = await response.json();
        console.log('Response data:', responseData);
        console.log('===== END FRONTEND DEBUG =====');

        if(response.status===200){
            Swal.fire({
                title: 'Success',
                text: 'Lab settings updated successfully',
                icon: 'success',
                confirmButtonText: 'Ok',
                timer: 1000,
            })
            // go to privious page
            setTimeout(() => {
                window.history.back();
            }, 2000);
        } else {
            console.log('error');
            Swal.fire({
                title: 'Error',
                text: 'Lab settings not updated',
                icon: 'error',
                confirmButtonText: 'Ok'
            })
        }
    }

    const saveExpiryDate = async () => {
        await editLab();
    };

    return (
        <div>
            <h1 style={{fontFamily: "Comic Sans MS"}}>Edit Group {labinfo ? " "+labinfo.labname : null} <ContactPageIcon fontSize='large'/></h1>
            <br/>
            <Form style={{fontFamily: "Comic Sans MS"}}>
                 <Form.Group className="mb-3" controlId="formCPUQuota">
                    <Form.Label>CPU Quota</Form.Label>
                    <Form.Control type="number" id="cpu_quota" placeholder={labinfo.cpuQuota} defaultValue={labinfo.cpuQuota}/>
                </Form.Group>
                <Form.Group className="mb-3" controlId="formMemoryQuota">
                    <Form.Label>Memory Quota</Form.Label>
                    <Form.Control type="number" id="memory_quota" placeholder={labinfo.memQuota} defaultValue={labinfo.memQuota}/>
                </Form.Group>
                <Form.Group className="mb-3" controlId="formGPUQuota">
                    <Form.Label>GPU Quota</Form.Label>
                    <Form.Control as="select" id="gpu_quota" defaultValue={labinfo.gpuQuota}>
                        <option value={labinfo.gpuQuota}>{labinfo.gpuQuota}</option>
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
                <Form.Group className="mb-3" controlId="formGPUVendor">
                    <Form.Label>GPU Vendor</Form.Label>
                    <Form.Control as="select" id="gpu_vendor" defaultValue={labinfo.gpuVendor}>
                        <option value="NVIDIA">nvidia</option>
                        <option value="AMD">amd</option>
                    </Form.Control>
                </Form.Group>
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
                        設定此群組的到期日期，到期後用戶將進入30天待刪除期
                    </Form.Text>
                </Form.Group>
                <Button variant="success" type="button" onClick={saveExpiryDate} style={{ marginBottom: '1rem' }}>
                    儲存到期日期
                </Button>
                {remainingDays !== null && (
                    <Alert variant={remainingDays <= 7 ? (remainingDays <= 3 ? 'danger' : 'warning') : 'info'}>
                        <strong>剩餘天數: {remainingDays} 天</strong>
                        {remainingDays <= 0 && ' (已到期)'}
                        {remainingDays > 0 && remainingDays <= 3 && ' (即將到期)'}
                        {remainingDays > 3 && remainingDays <= 7 && ' (接近到期)'}
                    </Alert>
                )} 
            </Form>
            <Button variant="primary" type="button" onClick={editLab}>
                Change group default settings
            </Button>
        </div>
    );
}



export default EditGroup;
