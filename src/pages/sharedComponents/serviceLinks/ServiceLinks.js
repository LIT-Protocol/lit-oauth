import './ServiceLinks.scss';
import {
  Button,
  Card, IconButton, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody
} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';

export default function ServiceLinks(props) {
  const listOfLinks = props.listOfLinks;
  const serviceName = props.serviceName;

  // const columns = [
  //   {
  //     width: 200,
  //     field: 'fileName',
  //     headerName: 'File Name',
  //   },
  //   {
  //     width: 200,
  //     field: 'requirements',
  //     headerName: 'Requirements',
  //   },
  //   {
  //     width: 200,
  //     field: 'fileType',
  //     headerName: 'File Type',
  //   },
  //   {
  //     width: 200,
  //     field: 'permission',
  //     headerName: 'Permission',
  //   },
  //   {
  //     width: 200,
  //     field: 'dateCreated',
  //     headerName: 'Date Created',
  //   },
  //   {
  //     width: 210,
  //     field: 'actions',
  //     headerName: 'Actions',
  //     renderCell: (cellValues) => {
  //       return (
  //         <span className={'links-actions'}>
  //             <IconButton size={'small'}>
  //               <EditIcon/>
  //             </IconButton>
  //             <IconButton size={'small'}>
  //               <LinkIcon/>
  //             </IconButton>
  //             <IconButton size={'small'}>
  //               <DownloadIcon/>
  //             </IconButton>
  //             <IconButton size={'small'}>
  //               <DeleteIcon/>
  //             </IconButton>
  //           </span>
  //       )
  //     }
  //   },
  // ]

  if (listOfLinks) {
    return (
      <section>
        <Card className={'links-card'}>
          <span className={'links-header'}>
            <h3>Your {serviceName} Files</h3>
            <Button variant='outlined' onClick={() => props.handleOpenProvisionAccessDialog()}>Provision Access</Button>
          </span>
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell align="left">File Name</TableCell>
                  <TableCell align="left">Requirements</TableCell>
                  <TableCell align="left">File Type</TableCell>
                  <TableCell align="left">Permission</TableCell>
                  <TableCell align="left">Date Created</TableCell>
                  <TableCell align="left">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listOfLinks.map((row) => (
                  <TableRow
                    key={row.name}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      {row.fileName}
                    </TableCell>
                    <TableCell align="left">{row.requirements}</TableCell>
                    <TableCell align="left">{row.fileType}</TableCell>
                    <TableCell align="left">{row.permission}</TableCell>
                    <TableCell align="left">{row.dateCreated}</TableCell>
                    <TableCell align="left">
                      <span className={'links-actions'}>
                        <IconButton size={'small'}>
                          <EditIcon/>
                        </IconButton>
                        <IconButton size={'small'}>
                          <LinkIcon/>
                        </IconButton>
                        <IconButton size={'small'}>
                          <DownloadIcon/>
                        </IconButton>
                        <IconButton size={'small'}>
                          <DeleteIcon/>
                        </IconButton>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </section>
    )
  } else {
    return (
      <span>Loading Links</span>
    )
  }
}
