function AddLab() {

    let addLab = async(e) => {
        let response = await fetch('http://127.0.0.1:8000/api/ldap/lab/add/', {    
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({"lab":e.target[0].value}),
        });
        let data = await response.json();
        if(response.status===200){
            console.log(data);
            alert('Lab added successfully');
        } else {
            console.log('error');
        }
    }

    return (
        <div>
            <h1>Add Lab</h1>
            <form onSubmit={addLab}>
                <label>Labatory Name:   </label><input type="text" placeholder="Please enter the lab name" /><br/>
                <input type="submit" value="Submit" />
            </form>
        </div>
    )
}
export default AddLab
