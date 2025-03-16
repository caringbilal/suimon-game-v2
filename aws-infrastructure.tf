# AWS Infrastructure Configuration

provider "aws" {
  region = "us-west-2"  # Change this to your preferred region
}

# Key Pair
resource "aws_key_pair" "backend_key" {
  key_name   = "suimon-backend-key"
  public_key = file("suimon-backend-key.pub")
}

# DynamoDB Tables
resource "aws_dynamodb_table" "players" {
  name           = "SuimonPlayers"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "playerId"

  attribute {
    name = "playerId"
    type = "S"
  }

  attribute {
    name = "wins"
    type = "N"
  }

  global_secondary_index {
    name               = "WinsIndex"
    hash_key           = "wins"
    projection_type    = "ALL"
  }
}

resource "aws_dynamodb_table" "games" {
  name           = "SuimonGames"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "gameId"
  range_key      = "startTime"

  attribute {
    name = "gameId"
    type = "S"
  }

  attribute {
    name = "startTime"
    type = "N"
  }

  attribute {
    name = "player1Id"
    type = "S"
  }

  global_secondary_index {
    name               = "PlayerGamesIndex"
    hash_key           = "player1Id"
    range_key          = "startTime"
    projection_type    = "ALL"
  }
}

# Elastic IP for Backend
resource "aws_eip" "backend_ip" {
  domain = "vpc"
  public_ipv4_pool = "amazon"
  tags = {
    Name = "suimon-backend-ip"
  }
}

# EC2 Instance
resource "aws_instance" "backend" {
  ami           = "ami-0735c191cf914754d"  # Amazon Linux 2023 in us-west-2
  instance_type = "t2.micro"
  key_name      = aws_key_pair.backend_key.key_name

  vpc_security_group_ids = [aws_security_group.backend_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.backend_profile.name

  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              yum install -y git
              curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
              . ~/.nvm/nvm.sh
              nvm install 16
              npm install -g pm2
              EOF

  tags = {
    Name = "suimon-backend"
  }
}

# Associate Elastic IP
resource "aws_eip_association" "backend_ip_assoc" {
  instance_id   = aws_instance.backend.id
  allocation_id = aws_eip.backend_ip.id
}

# Backend Deployment
resource "null_resource" "backend_deployment" {
  triggers = {
    always_run = timestamp()
  }

  provisioner "remote-exec" {
    inline = [
      "#!/bin/bash",
      "sleep 30",  # Wait for instance to fully initialize
      "sudo chmod 600 ~/.ssh/authorized_keys",
      "cd /home/ec2-user",
      "git clone https://github.com/bilal-abraham/suimon-simple-card-game.git suimon-game || (cd suimon-game && git pull)",
      "cd suimon-game/backend",
      "npm install",
      "pm2 delete suimon-backend || true",
      "pm2 start server.js --name \"suimon-backend\" --time",
      "pm2 save"
    ]
  }

  connection {
    type        = "ssh"
    user        = "ec2-user"
    private_key = file("suimon-backend-key")
    host        = aws_eip.backend_ip.public_ip
  }

  # Note: vpc_security_group_ids and iam_instance_profile are not valid for null_resource
  # These are automatically applied to the EC2 instance through the data source
}

# IAM Role and Instance Profile
resource "aws_iam_role" "backend_role" {
  name = "suimon-backend-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "dynamodb_access" {
  name = "dynamodb-access"
  role = aws_iam_role.backend_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.players.arn,
          aws_dynamodb_table.games.arn,
          "${aws_dynamodb_table.games.arn}/index/*",
          "${aws_dynamodb_table.players.arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "backend_profile" {
  name = "suimon-backend-profile"
  role = aws_iam_role.backend_role.name
}

# Security Group
resource "aws_security_group" "backend_sg" {
  name        = "suimon-backend-sg"
  description = "Security group for Suimon game backend"

  ingress {
    from_port   = 3002
    to_port     = 3002
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow WebSocket and HTTP connections"
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow SSH access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "suimon-backend-sg"
    Environment = "production"
  }
}

# Output the public IP
output "backend_public_ip" {
  value = aws_eip.backend_ip.public_ip
}