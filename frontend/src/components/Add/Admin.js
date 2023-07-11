function AddAdmin() {
    return (
        <div>
            <h1>Add Admin</h1>
            <form>
                <lable>Choice a User to be the OpenLDAP administer:</lable>
                <select>
                    <option value="user1">User 1</option>
                    <option value="user2">User 2</option>
                    <option value="user3">User 3</option>
                    <option value="user4">User 4</option>
                </select><br/>
                <button>Submit</button>
            </form>
        </div>
    )
}

export default AddAdmin