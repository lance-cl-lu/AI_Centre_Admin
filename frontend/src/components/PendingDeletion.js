import React, { useState, useEffect, useContext } from 'react';
import { Table, Button, Card, Badge, Modal, Alert } from 'react-bootstrap';
import AuthContext from '../context/AuthContext';
import Swal from 'sweetalert2';

function PendingDeletion() {
    const { user, authTokens } = useContext(AuthContext);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        fetchPendingUsers();
    }, []);

    const fetchPendingUsers = async () => {
        try {
            const response = await fetch('/api/ldap/pending-deletion/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authTokens?.access,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                setPendingUsers(data.pending_users);
            } else {
                console.error('Failed to fetch pending users');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const cancelDeletion = async (pendingId, username) => {
        try {
            const result = await Swal.fire({
                title: '確認取消刪除',
                text: `確定要取消刪除用戶 ${username} 嗎？`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: '確認取消',
                cancelButtonText: '取消'
            });

            if (result.isConfirmed) {
                const response = await fetch('/api/ldap/pending-deletion/cancel/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + authTokens?.access,
                    },
                    body: JSON.stringify({ pending_id: pendingId })
                });

                if (response.ok) {
                    Swal.fire(
                        '已取消！',
                        `用戶 ${username} 的刪除排程已取消`,
                        'success'
                    );
                    fetchPendingUsers(); // Refresh the list
                } else {
                    Swal.fire('錯誤', '取消刪除失敗', 'error');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('錯誤', '發生未知錯誤', 'error');
        }
    };

    const getDaysUntilDeletionBadge = (days) => {
        if (days <= 3) {
            return <Badge bg="danger">{days} 天</Badge>;
        } else if (days <= 7) {
            return <Badge bg="warning">{days} 天</Badge>;
        } else {
            return <Badge bg="secondary">{days} 天</Badge>;
        }
    };

    if (loading) {
        return <div className="text-center">Loading...</div>;
    }

    return (
        <div className="container mt-4">
            <Card>
                <Card.Header>
                    <h4>待刪除用戶管理</h4>
                    <small className="text-muted">顯示已從群組移除並等待刪除的用戶</small>
                </Card.Header>
                <Card.Body>
                    {pendingUsers.length === 0 ? (
                        <Alert variant="info">
                            目前沒有待刪除的用戶
                        </Alert>
                    ) : (
                        <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>用戶名稱</th>
                                    <th>電子郵件</th>
                                    <th>姓名</th>
                                    <th>移出的群組</th>
                                    <th>移除日期</th>
                                    <th>預定刪除日期</th>
                                    <th>剩餘天數</th>
                                    <th>移除原因</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingUsers.map((pendingUser) => (
                                    <tr key={pendingUser.id}>
                                        <td>{pendingUser.username}</td>
                                        <td>{pendingUser.email}</td>
                                        <td>{`${pendingUser.first_name} ${pendingUser.last_name}`.trim()}</td>
                                        <td>
                                            <small className="text-muted">
                                                {pendingUser.removed_from_groups}
                                            </small>
                                        </td>
                                        <td>{new Date(pendingUser.removal_date).toLocaleDateString('zh-TW')}</td>
                                        <td>{new Date(pendingUser.scheduled_deletion_date).toLocaleDateString('zh-TW')}</td>
                                        <td>{getDaysUntilDeletionBadge(pendingUser.days_until_deletion)}</td>
                                        <td>
                                            <small>{pendingUser.removal_reason || '未指定'}</small>
                                        </td>
                                        <td>
                                            <Button 
                                                variant="outline-success" 
                                                size="sm"
                                                onClick={() => cancelDeletion(pendingUser.id, pendingUser.username)}
                                            >
                                                取消刪除
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                    
                    <div className="mt-3">
                        <small className="text-muted">
                            共 {pendingUsers.length} 個待刪除用戶
                        </small>
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
}

export default PendingDeletion;