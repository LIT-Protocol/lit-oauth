import './ServiceLinks.scss';
import {
  Button,
  Card, IconButton,
} from "@mui/material";
// import MUIDataTable from "mui-datatables";
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';

export default function ServiceLinks(props) {
  const listOfLinks = props.listOfLinks;
  const serviceName = props.serviceName;

  const columns = [
    {
      name: 'fileName',
      label: 'File Name',
      options: {
        filter: true,
        sort: true
      }
    },
    {
      name: 'requirements',
      label: 'Requirements',
      options: {
        filter: true,
        sort: true
      }
    },
    {
      name: 'fileType',
      label: 'File Type',
      options: {
        filter: true,
        sort: true
      }
    },
    {
      name: 'permission',
      label: 'Permission',
      options: {
        filter: true,
        sort: true
      }
    },
    {
      name: 'dateCreated',
      label: 'Date Created',
      options: {
        filter: true,
        sort: true
      }
    },
    {
      name: 'actions',
      label: 'Actions',
      options: {
        filter: false,
        sort: false,
        customBodyRenderLite: (dataIndex, rowIndex) => {
          return (
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
          )
        }
      }
    },
  ]

  const tableOptions = {
    selectableRowsHideCheckboxes: true,
    download: false,
    print: false,
    viewColumns: false,
  }

  if (listOfLinks && columns) {
    return (
      <section>
        <Card className={'links-card'}>
          <span className={'links-header'}>
            <h3>Your {serviceName} Files</h3>
            <Button variant='outlined' onClick={() => props.handleOpenProvisionAccessDialog()}>Provision Access</Button>
          </span>
          {/*TODO: remove 'material-ui/icons' and 'material-ui/core' from package.json once MUI Datatables is updated to use v5*/}
          {/*<MUIDataTable*/}
          {/*  columns={columns}*/}
          {/*  data={listOfLinks}*/}
          {/*  options={tableOptions}*/}
          {/*/>*/}
        </Card>
      </section>
    )
  } else {
    return (
      <span>Loading Links</span>
    )
  }
}
